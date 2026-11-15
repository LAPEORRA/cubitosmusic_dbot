import assert from 'node:assert/strict';
import { test } from 'node:test';
import { queue } from '../../src/commands/music/queue.js';

type ReplyPayload = {
  content?: string;
  embeds?: Array<{
    data: {
      author?: { name?: string };
      description?: string;
      color?: number;
      footer?: { text?: string };
      thumbnail?: { url?: string };
      title?: string;
    };
  }>;
  allowedMentions?: { parse: string[] };
  flags?: number;
};

test('shows the current track through the command when no tracks are pending', async () => {
  let response: ReplyPayload | undefined;
  const interaction = {
    guildId: 'guild-1',
    deferred: false,
    replied: false,
    async reply(payload: ReplyPayload) {
      response = payload;
    },
    async editReply(payload: ReplyPayload) {
      response = payload;
    },
  };

  await queue(interaction, {
    currentTrack: {
      title: '@everyone Canción actual',
      author: 'Artista',
      thumbnail: 'https://example.com/cover.jpg',
    },
    tracks: { data: [{ title: 'Siguiente', author: 'Artista', duration: '03:45' }] },
  });

  assert.equal(response?.flags, undefined, 'la respuesta exitosa es pública');
  const embed = response?.embeds?.[0]?.data;
  assert.equal(embed?.color, 0x5865f2);
  assert.equal(embed?.author?.name, 'CubitoMusic');
  assert.equal(embed?.title, '📋 Cola de reproducción');
  assert.match(embed?.description ?? '', /🎵 \*\*Ahora:\*\* @everyone Canción actual/);
  assert.match(embed?.description ?? '', /Cola \(1\):\*\*\n1\. \*\*Siguiente\*\* — Artista `03:45`/);
  assert.equal(embed?.thumbnail?.url, 'https://example.com/cover.jpg');
  assert.equal(embed?.footer?.text, '1 canción en espera');
  assert.deepEqual(response?.allowedMentions?.parse, []);
});

test('edits an acknowledged interaction for an empty queue', async () => {
  let replied = false;
  let edited: ReplyPayload | undefined;
  const interaction = {
    guildId: 'guild-1',
    deferred: true,
    replied: false,
    async reply() {
      replied = true;
    },
    async editReply(payload: ReplyPayload) {
      edited = payload;
    },
  };

  await queue(interaction, null);

  assert.equal(replied, false);
  assert.equal(edited?.flags, undefined, 'la edición mantiene la respuesta pública');
  assert.equal(edited?.embeds?.[0]?.data.description, '📭 No hay canciones en la cola.');
});
