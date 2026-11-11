import assert from 'node:assert/strict';
import { test } from 'node:test';
import { queue } from '../../src/commands/music/queue.js';

test('shows the current track through the command when no tracks are pending', async () => {
  let response = '';
  let allowedMentions: { parse: string[] } | undefined;
  const interaction = {
    guildId: 'guild-1',
    deferred: false,
    replied: false,
    async reply(payload: { content: string; allowedMentions?: { parse: string[] } }) {
      response = payload.content;
      allowedMentions = payload.allowedMentions;
    },
    async editReply(payload: { content: string; allowedMentions?: { parse: string[] } }) {
      response = payload.content;
      allowedMentions = payload.allowedMentions;
    },
  };

  await queue(interaction, {
    currentTrack: { title: '@everyone Canción actual', author: 'Artista' },
    tracks: { data: [] },
  });

  assert.match(response, /🎵 \*\*Ahora:\*\* @everyone Canción actual/);
  assert.match(response, /📋 \*\*Cola \(0\):\*\* vacía/);
  assert.deepEqual(allowedMentions?.parse, []);
});

test('edits an acknowledged interaction for an empty queue', async () => {
  let replied = false;
  let editedResponse = '';
  const interaction = {
    guildId: 'guild-1',
    deferred: true,
    replied: false,
    async reply() {
      replied = true;
    },
    async editReply(payload: { content: string }) {
      editedResponse = payload.content;
    },
  };

  await queue(interaction, null);

  assert.equal(replied, false);
  assert.equal(editedResponse, '📭 No hay canciones en la cola.');
});
