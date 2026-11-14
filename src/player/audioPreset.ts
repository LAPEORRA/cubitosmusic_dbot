type CompressorParametersLike = {
  threshold: number;
  ratio: number;
  attack: number;
  release: number;
  makeupGain: number;
  kneeWidth: number;
};

export const COMPRESSOR_PRESET: CompressorParametersLike = {
  threshold: -14,
  ratio: 3,
  attack: 20,
  release: 150,
  makeupGain: 0,
  kneeWidth: 8,
};

/**
 * Valida que la cola pueda operar con el preset de audio.
 * No muta propiedades privadas de los filtros (`_lastFiltersCache`) ni invoca
 * `ffmpeg.setFilters`: esa vía rompe el stream PCM del extractor.
 */
export function enableAudioPreset(queue: any): boolean {
  return Boolean(queue?.node);
}