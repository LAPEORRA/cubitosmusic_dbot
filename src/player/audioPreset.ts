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

export function enableAudioPreset(queue: any): boolean {
  try {
    const cache = queue?.filters?._lastFiltersCache as {
      compressor: CompressorParametersLike | null;
    } | null;
    if (!cache) return false;
    cache.compressor = COMPRESSOR_PRESET;
    console.log(`🎧 Compresor DSP activado: ${JSON.stringify(COMPRESSOR_PRESET)}`);
    return true;
  } catch (error) {
    console.error('❌ No se pudo activar el preset de audio:', error);
    return false;
  }
}