import { logRow } from '../utils/logger.js';

type CompressorParametersLike = {
  threshold: number;
  ratio: number;
  attack: number;
  release: number;
  makeupGain: number;
  kneeWidth: number;
};

type ReverbParametersLike = {
  roomSize: number;
  damping: number;
  wetLevel: number;
  dryLevel: number;
};

/**
 * Perfil del compresor PCM nativo.
 *
 * Calibrado para masters de YouTube con graves fuertes: umbral moderado
 * (-15 dBFS), ratio 3:1, attack lento (25 ms) y knee suave (6 dB). El attack
 * lento deja pasar el transitorio del bombo sin disparar la reducción de
 * ganancia completa, evitando el *pumping* que aplastaba medios y agudos al
 * reproducir al 100 %.
 */
export const COMPRESSOR_PRESET: CompressorParametersLike = {
  threshold: -15,
  ratio: 3,
  attack: 25,
  release: 150,
  makeupGain: 0,
  kneeWidth: 6,
};

/**
 * Reverb totalmente seca.
 *
 * El `ReverbTransformer` de `@discord-player/equalizer` aplica
 * `output = input * dryLevel + wet * wetLevel / numDelayLines`; con
 * `wetLevel: 0` y `dryLevel: 1` la señal pasa intacta (sin colorear el audio ni
 * perder ganancia seca, el ~30 % que restaba el preset por defecto
 * `0.3 / 0.7`).
 */
export const DRY_REVERB_PRESET: Pick<ReverbParametersLike, 'wetLevel' | 'dryLevel'> = {
  wetLevel: 0,
  dryLevel: 1,
};

/**
 * Superficie pública de `queue.filters.compressor` en discord-player v7.2:
 * getter `compressor` → `CompressorTransformer | null`, cuyo `setCompressor`
 * es **síncrono** y devuelve los parámetros aplicados.
 */
type CompressorHandleLike = {
  setCompressor: (options: Partial<CompressorParametersLike>) => unknown;
};

/**
 * Superficie pública de `queue.filters.reverb` en discord-player v7.2:
 * getter `reverb` → `ReverbTransformer | null`, con
 * `setReverb(options: Partial<ReverbParameters>): ReverbParameters` **síncrono**.
 */
type ReverbHandleLike = {
  setReverb: (options: Partial<ReverbParametersLike>) => unknown;
};

/**
 * Aplica el perfil DSP nativo de discord-player sobre la cola: compresor PCM
 * calibrado y reverb 100 % seca.
 *
 * Vía pública: `queue.filters.compressor.setCompressor(...)` y
 * `queue.filters.reverb.setReverb(...)`, que reescriben los transformadores del
 * `FiltersChain` del stream y, vía el evento `compressor`/`reverb` del
 * dispatcher, sincronizan `_lastFiltersCache` (así las pistas siguientes
 * heredan el perfil sin tocar propiedades privadas).
 *
 * Requiere `nodeOptions.disableCompressor: false` en `/play` para que el
 * dispatcher instale el `CompressorTransformer`. La reverb se crea igual con
 * `disableReverb: true` (default); si el getter devuelve `null` (por ejemplo en
 * `queueCreate`, antes del dispatcher, o en pistas posteriores que heredan el
 * preset ya seco) simplemente se omite sin fallar.
 *
 * NO usa `ffmpeg.setFilters` (rompe el stream PCM `$fmt: 'raw'`) ni propiedades
 * privadas (`_lastFiltersCache` se actualiza solo, nunca a mano).
 *
 * @returns `true` si al menos uno de los presets quedó aplicado; `false` si no
 * hay dispatcher/transformadores disponibles o si la llamada falló (se registra
 * sin abortar la reproducción).
 */
export function enableAudioPreset(queue: any): boolean {
  const compressor = queue?.filters?.compressor as CompressorHandleLike | null | undefined;
  const reverb = queue?.filters?.reverb as ReverbHandleLike | null | undefined;

  const canCompress = !!compressor && typeof compressor.setCompressor === 'function';
  const canDryReverb = !!reverb && typeof reverb.setReverb === 'function';
  if (!canCompress && !canDryReverb) return false;

  let applied = false;

  try {
    if (canCompress) {
      compressor.setCompressor(COMPRESSOR_PRESET);
      applied = true;
    }
    if (canDryReverb) {
      reverb.setReverb(DRY_REVERB_PRESET);
      applied = true;
    }
    return applied;
  } catch (error: any) {
    logRow({
      badge: 'PRESET',
      color: 'yellow',
      channel: queue?.channel?.name ?? null,
      detail: `Preset no aplicado: ${error?.message ?? String(error)}`,
    });
    return applied;
  }
}
