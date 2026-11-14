import assert from 'node:assert/strict';
import { test } from 'node:test';
import { enableAudioPreset } from '../../src/player/audioPreset.js';

test('enableAudioPreset valida la cola sin mutar el caché privado de filtros', () => {
  const cache = { compressor: null };
  let setFiltersCalls = 0;

  const queue = {
    node: {},
    filters: {
      _lastFiltersCache: cache,
      setFilters: () => {
        setFiltersCalls += 1;
      },
    },
  };

  assert.equal(enableAudioPreset(queue), true);
  assert.equal(cache.compressor, null, 'no debe escribir _lastFiltersCache');
  assert.equal(setFiltersCalls, 0, 'no debe llamar a setFilters');
});

test('enableAudioPreset devuelve false sin cola o sin nodo', () => {
  assert.equal(enableAudioPreset(undefined), false);
  assert.equal(enableAudioPreset(null), false);
  assert.equal(enableAudioPreset({}), false);
});
