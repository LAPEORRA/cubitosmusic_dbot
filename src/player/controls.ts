import { GuildMember } from 'discord.js';
import { GuildQueue, Track } from 'discord-player';
import { useQueue } from 'discord-player';
import { traceEvent } from '../utils/logger.js';

type InteractionLike = {
  guildId: string;
  member: GuildMember | null;
};

/**
 * Volumen deseado por cola. `queue.node.volume` no sirve como fuente de verdad:
 * devuelve `100` mientras el `VolumeTransformer` del stream no existe, y la cadena
 * DSP se reconstruye en cada pista. Aquí recordamos lo que el usuario eligió
 * (`/volume`) o el valor por defecto de `/play` (70).
 */
const desiredVolumeByQueue = new WeakMap<GuildQueue, number>();

/** `AudioPlayer`s con una reaplicación de volumen pendiente (evita duplicar listeners). */
const pendingVolumeReapply = new WeakSet<object>();

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 70;
  return Math.min(100, Math.max(0, Math.trunc(value)));
}

/**
 * Transformador que realmente atenúa el audio.
 *
 * Ojo: `queue.dispatcher.volume` es un **getter numérico**, no el transformador.
 * El objeto con `setVolume` vive en `queue.dispatcher.dsp.volume`
 * (`VolumeTransformer` de `@discord-player/equalizer`); `queue.node.setVolume`
 * delega ahí pero **sale en silencio** (`false`) si el dispatcher o el DSP aún no
 * existen (`queueCreate`), y la cadena se rehace en cada pista.
 */
function getVolumeTransformer(queue: GuildQueue): { setVolume: (value: number) => unknown } | null {
  const transformer = (queue as any)?.dispatcher?.dsp?.volume;
  return transformer && typeof transformer.setVolume === 'function' ? transformer : null;
}

export function getDesiredVolume(queue: GuildQueue, fallback = 70): number {
  return desiredVolumeByQueue.get(queue) ?? clampVolume(fallback);
}

/**
 * Fija la ganancia real del stream al volumen objetivo.
 *
 * Escribe en dos sitios para que el panel y el audio coincidan desde el primer
 * segundo: el nodo (mantiene `_lastFiltersCache.volume` y el footer `Vol N%`) y el
 * `VolumeTransformer` activo (el que atenúa las muestras PCM). Es idempotente:
 * `VolumeTransformer.setVolume` no tiene guarda de igualdad, así que repetir el
 * mismo valor no cuesta nada.
 *
 * @returns el volumen efectivamente aplicado (clampeado a 0-100).
 */
export function applyInitialVolume(queue: GuildQueue, targetVolume = 70): number {
  const volume = clampVolume(targetVolume);
  if (!queue) return volume;
  desiredVolumeByQueue.set(queue, volume);

  try {
    queue.node?.setVolume?.(volume);
  } catch {
    // El nodo puede fallar si la cola se está desmontando: el audio sigue.
  }

  const transformer = getVolumeTransformer(queue);
  if (transformer) {
    try {
      transformer.setVolume(volume);
    } catch {
      // Si el transformador está cerrado, la pista siguiente reaplica el volumen.
    }
  }

  traceEvent('audio', 'volume_applied', {
    guildId: queue?.guild?.id ?? null,
    granted: volume,
    nodeVolume: queue?.node?.volume ?? null,
    transformerActive: Boolean(transformer),
  });

  return volume;
}

/**
 * Red de seguridad para el caso en que el `AudioResource` se adjunte **después**
 * de `playerStart` (transiciones/buffering): reaplica el volumen en cuanto el
 * `AudioPlayer` entre en `playing`. No hace nada si ya estaba reproduciendo (el
 * volumen se aplicó de forma síncrona) ni duplica listeners por `AudioPlayer`.
 */
export function reapplyVolumeWhenPlaying(queue: GuildQueue, targetVolume = 70): void {
  const audioPlayer = (queue as any)?.dispatcher?.audioPlayer;
  if (!audioPlayer || typeof audioPlayer.on !== 'function') return;
  if (audioPlayer.state?.status === 'playing') return;
  if (pendingVolumeReapply.has(audioPlayer)) return;

  pendingVolumeReapply.add(audioPlayer);
  const onStateChange = (_old: any, next: any) => {
    if (next?.status !== 'playing') return;
    audioPlayer.off?.('stateChange', onStateChange);
    pendingVolumeReapply.delete(audioPlayer);
    applyInitialVolume(queue, targetVolume);
  };
  audioPlayer.on('stateChange', onStateChange);
}


function getMemberVoiceChannel(interaction: InteractionLike) {
  return interaction.member?.voice?.channel ?? null;
}

export function requireVoiceChannel(interaction: InteractionLike) {
  return getMemberVoiceChannel(interaction) !== null;
}

export function isSameVoiceChannel(
  memberChannelId: string | null | undefined,
  botChannelId: string | null | undefined,
): boolean {
  return Boolean(memberChannelId && botChannelId && memberChannelId === botChannelId);
}

export function requireSameVoiceChannel(interaction: InteractionLike, queue: GuildQueue): boolean {
  return isSameVoiceChannel(interaction.member?.voice?.channelId, queue.channel?.id);
}

/**
 * El bot solo puede estar en un canal de voz: si aún no tiene cola/canal,
 * se permite cualquier canal; si ya está conectado, debe coincidir.
 */
export function canPlayInChannel(
  botChannelId: string | null | undefined,
  userChannelId: string | null | undefined,
): boolean {
  if (!botChannelId) return true;
  return botChannelId === userChannelId;
}

export function getQueue(interaction: InteractionLike): GuildQueue | null {
  return useQueue(interaction.guildId);
}

export function togglePause(queue: GuildQueue): boolean {
  if (queue.node.isPaused()) {
    queue.node.resume();
    return false; // ahora reproduciendo
  }
  queue.node.pause();
  return true; // ahora pausado
}

export function skipTrack(queue: GuildQueue): boolean {
  if (!queue.isPlaying() && !queue.node.isPaused()) return false;
  if (queue.node.isPaused()) queue.node.resume();
  queue.node.skip();
  return true;
}

export async function backTrack(queue: GuildQueue): Promise<boolean> {
  if (!queue.history || queue.history.isEmpty()) return false;
  if (queue.node.isPaused()) queue.node.resume();
  await queue.history.previous();
  return true;
}

export function toggleLoop(queue: GuildQueue) {
  if (queue.repeatMode === 1) queue.setRepeatMode(0);
  else queue.setRepeatMode(1);
  return queue.repeatMode;
}

/** Ajusta el volumen de la cola (1-100). Devuelve el nivel aplicado o `null` si es inválido. */
export function setQueueVolume(queue: GuildQueue, volume: number): number | null {
  if (!Number.isInteger(volume) || volume < 1 || volume > 100) return null;
  return applyInitialVolume(queue, volume);
}

export function shuffleQueue(queue: GuildQueue): boolean {
  if (!queue.tracks.data.length) return false;
  queue.tracks.shuffle();
  return true;
}

/** Vacía la cola. Devuelve `true` si había canciones. */
export function clearQueue(queue: GuildQueue): boolean {
  if (!queue.tracks.size) return false;
  queue.tracks.clear();
  return true;
}

/** Elimina la pista en `position` (1-based). Devuelve la pista o `null` si no existe. */
export function removeTrack(queue: GuildQueue, position: number): Track | null {
  const index = position - 1;
  const track = queue.tracks.at(index);
  if (!track) return null;
  queue.tracks.removeOne((_track, idx) => idx === index);
  return track;
}

/** Salta a la pista en `position` (1-based) y la devuelve; `null` si no existe o falla. */
export function skipTo(queue: GuildQueue, position: number): Track | null {
  const target = queue.tracks.at(position - 1) ?? null;
  if (!target) return null;
  if (queue.node.isPaused()) queue.node.resume();
  if (!queue.node.skipTo(position - 1)) return null;
  return target;
}

export async function stopQueue(queue: GuildQueue) {
  // Vaciar la cola antes del desmontaje evita que `discord-player` intente
  // inicializar o extraer la siguiente pista mientras se cierra la conexión.
  queue.tracks.clear();
  // Desconexión explícita: `queue.delete()` no siempre cierra la conexión si el
  // reproductor está en transición o pausado, y quedan conexiones huérfanas.
  queue.connection?.disconnect();
  queue.delete();
}