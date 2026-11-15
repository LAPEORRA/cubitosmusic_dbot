import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  COMPRESSOR_PRESET,
  DRY_REVERB_PRESET,
  enableAudioPreset,
} from '../../src/player/audioPreset.js';

test('COMPRESSOR_PRESET mantiene el perfil anti-pumping calibrado', () => {
  assert.deepEqual(COMPRESSOR_PRESET, {
    threshold: -15,
    ratio: 3,
    attack: 25,
    release: 150,
    makeupGain: 0,
    kneeWidth: 6,
  });
});

test('DRY_REVERB_PRESET deja la señal 100% seca', () => {
  assert.deepEqual(DRY_REVERB_PRESET, { wetLevel: 0, dryLevel: 1 });
});

test('enableAudioPreset aplica el preset exacto con filters.compressor.setCompressor', () => {
  const calls: unknown[] = [];

  const queue = {
    node: {},
    filters: {
      compressor: {
        setCompressor: (options: unknown) => {
          calls.push(options);
          return COMPRESSOR_PRESET;
        },
      },
    },
  };

  assert.equal(enableAudioPreset(queue), true);
  assert.equal(calls.length, 1, 'debe llamar exactamente una vez a setCompressor');
  assert.deepEqual(calls[0], {
    threshold: -15,
    ratio: 3,
    attack: 25,
    release: 150,
    makeupGain: 0,
    kneeWidth: 6,
  });
});

test('enableAudioPreset aplica DRY_REVERB_PRESET cuando filters.reverb existe', () => {
  const compressorCalls: unknown[] = [];
  const reverbCalls: unknown[] = [];

  const queue = {
    node: {},
    filters: {
      compressor: {
        setCompressor: (options: unknown) => {
          compressorCalls.push(options);
          return COMPRESSOR_PRESET;
        },
      },
      reverb: {
        setReverb: (options: unknown) => {
          reverbCalls.push(options);
          return DRY_REVERB_PRESET;
        },
      },
    },
  };

  assert.equal(enableAudioPreset(queue), true);
  assert.equal(compressorCalls.length, 1, 'aplica el compresor una vez');
  assert.equal(reverbCalls.length, 1, 'aplica la reverb una vez');
  assert.deepEqual(reverbCalls[0], { wetLevel: 0, dryLevel: 1 });
});

test('enableAudioPreset no falla si filters.reverb es null', () => {
  const compressorCalls: unknown[] = [];

  const queue = {
    node: {},
    filters: {
      compressor: {
        setCompressor: (options: unknown) => {
          compressorCalls.push(options);
          return COMPRESSOR_PRESET;
        },
      },
      reverb: null,
    },
  };

  let result: boolean | undefined;
  assert.doesNotThrow(() => {
    result = enableAudioPreset(queue);
  });
  assert.equal(result, true);
  assert.equal(compressorCalls.length, 1);
});

test('enableAudioPreset aplica solo la reverb si el compresor no está disponible', () => {
  const reverbCalls: unknown[] = [];

  const queue = {
    node: {},
    filters: {
      compressor: null,
      reverb: {
        setReverb: (options: unknown) => {
          reverbCalls.push(options);
          return DRY_REVERB_PRESET;
        },
      },
    },
  };

  assert.equal(enableAudioPreset(queue), true);
  assert.deepEqual(reverbCalls[0], { wetLevel: 0, dryLevel: 1 });
});

test('enableAudioPreset no usa ffmpeg.setFilters ni escribe el caché privado de filtros', () => {
  const cache = { compressor: null, reverb: null };
  let setFiltersCalls = 0;

  const queue = {
    node: {},
    filters: {
      _lastFiltersCache: cache,
      setFilters: () => {
        setFiltersCalls += 1;
      },
      compressor: { setCompressor: () => COMPRESSOR_PRESET },
      reverb: { setReverb: () => DRY_REVERB_PRESET },
    },
  };

  assert.equal(enableAudioPreset(queue), true);
  assert.equal(cache.compressor, null, 'no debe escribir _lastFiltersCache.compressor');
  assert.equal(cache.reverb, null, 'no debe escribir _lastFiltersCache.reverb');
  assert.equal(setFiltersCalls, 0, 'no debe llamar a setFilters');
});

test('enableAudioPreset devuelve false sin cola, sin nodo, sin dispatcher ni transformadores', () => {
  assert.equal(enableAudioPreset(undefined), false);
  assert.equal(enableAudioPreset(null), false);
  assert.equal(enableAudioPreset({}), false);
  // `queueCreate`: aún no hay dispatcher, los getters devuelven null
  assert.equal(enableAudioPreset({ node: {}, filters: { compressor: null } }), false);
  assert.equal(enableAudioPreset({ node: {}, filters: { compressor: null, reverb: null } }), false);
  // transformadores presentes pero sin la API esperada
  assert.equal(enableAudioPreset({ node: {}, filters: { compressor: {} } }), false);
  assert.equal(enableAudioPreset({ node: {}, filters: { compressor: {}, reverb: {} } }), false);
});

test('enableAudioPreset no lanza si setCompressor falla y devuelve false', () => {
  const queue = {
    node: {},
    channel: { name: 'General' },
    filters: {
      compressor: {
        setCompressor: () => {
          throw new Error('stream sin DSP');
        },
      },
    },
  };

  let result: boolean | undefined;
  assert.doesNotThrow(() => {
    result = enableAudioPreset(queue);
  });
  assert.equal(result, false);
});

test('enableAudioPreset no lanza si setReverb falla y conserva el compresor aplicado', () => {
  const compressorCalls: unknown[] = [];

  const queue = {
    node: {},
    channel: { name: 'General' },
    filters: {
      compressor: {
        setCompressor: (options: unknown) => {
          compressorCalls.push(options);
          return COMPRESSOR_PRESET;
        },
      },
      reverb: {
        setReverb: () => {
          throw new Error('reverb sin DSP');
        },
      },
    },
  };

  let result: boolean | undefined;
  assert.doesNotThrow(() => {
    result = enableAudioPreset(queue);
  });
  assert.equal(result, true);
  assert.equal(compressorCalls.length, 1);
});
