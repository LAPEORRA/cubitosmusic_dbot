import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildQueueEmbed,
  buildQueueReply,
  buildQueueSummary,
} from '../../src/player/queueSummary.js';

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
    duration: '03:45',
  }));

  const summary = buildQueueSummary(null, tracks);

  assert.match(summary, /📋 \*\*Cola \(11\):\*\*/);
  assert.match(summary, /Cola \(11\):\*\*\n1\. \*\*Canción 1\*\* — Artista `03:45`/);
  assert.match(summary, /10\. \*\*Canción 10\*\* — Artista `03:45`/);
  assert.match(summary, /\.\.\. y 1 más/);
  assert.doesNotMatch(summary, /11\. \*\*Canción 11\*\*/);
});

test('omits a missing track duration', () => {
  const summary = buildQueueSummary(null, [{ title: 'En vivo', author: 'Artista' }]);

  assert.match(summary, /Cola \(1\):\*\*\n1\. \*\*En vivo\*\* — Artista/);
  assert.doesNotMatch(summary, /`/);
});

test('builds the branded queue embed with a valid thumbnail and waiting count', () => {
  const embed = buildQueueEmbed(
    {
      title: 'Canción actual',
      author: 'Artista',
      thumbnail: 'https://example.com/cover.jpg',
    },
    [{ title: 'Siguiente', author: 'Artista', duration: '03:45' }],
  ).toJSON();

  assert.equal(embed.color, 0x5865f2);
  assert.equal(embed.author?.name, 'CubitoMusic');
  assert.equal(embed.title, '📋 Cola de reproducción');
  assert.match(embed.description ?? '', /Cola \(1\):\*\*\n1\. \*\*Siguiente\*\* — Artista `03:45`/);
  assert.equal(embed.thumbnail?.url, 'https://example.com/cover.jpg');
  assert.equal(embed.footer?.text, '1 canción en espera');

  const pluralEmbed = buildQueueEmbed(null, [
    { title: 'Primera', author: 'Artista' },
    { title: 'Segunda', author: 'Artista' },
  ]).toJSON();
  assert.equal(pluralEmbed.footer?.text, '2 canciones en espera');
});

test('uses the brand footer and omits invalid thumbnails for an empty queue', () => {
  const embed = buildQueueEmbed(
    { title: 'Actual', author: 'Artista', thumbnail: 'javascript:alert(1)' },
    [],
  ).toJSON();

  assert.equal(embed.description, '🎵 **Ahora:** Actual\n📋 **Cola (0):** vacía');
  assert.equal(embed.thumbnail, undefined);
  assert.equal(embed.footer?.text, 'CubitoMusic');
});
