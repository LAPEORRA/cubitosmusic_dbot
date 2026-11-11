import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildQueueReply, buildQueueSummary } from '../../src/player/queueSummary.js';

test('returns the empty-queue response only when there is no current or upcoming track', () => {
  assert.deepEqual(
    buildQueueReply(null, []),
    { content: '📭 No hay canciones en la cola.', allowedMentions: { parse: [] } },
  );
});

test('returns the current track response when there are no upcoming tracks', () => {
  const response = buildQueueReply(
    { title: 'Canción actual', author: 'Artista' },
    [],
  );

  assert.match(response.content, /🎵 \*\*Ahora:\*\* Canción actual/);
  assert.match(response.content, /📋 \*\*Cola \(0\):\*\* vacía/);
  assert.deepEqual(response.allowedMentions.parse, []);
  assert.doesNotMatch(response.content, /No hay canciones en la cola/);
});

test('shows the current track when there are no upcoming tracks', () => {
  const summary = buildQueueSummary(
    { title: 'Canción actual', author: 'Artista' },
    [],
  );

  assert.match(summary, /🎵 \*\*Ahora:\*\* Canción actual/);
  assert.match(summary, /📋 \*\*Cola \(0\):\*\* vacía/);
});

test('shows queued tracks and the number beyond the display limit', () => {
  const tracks = Array.from({ length: 11 }, (_, index) => ({
    title: `Canción ${index + 1}`,
    author: 'Artista',
  }));

  const summary = buildQueueSummary(null, tracks);

  assert.match(summary, /📋 \*\*Cola \(11\):\*\*/);
  assert.match(summary, /10\. \*\*Canción 10\*\* — Artista/);
  assert.match(summary, /\.\.\. y 1 más/);
  assert.doesNotMatch(summary, /11\. \*\*Canción 11\*\*/);
});
