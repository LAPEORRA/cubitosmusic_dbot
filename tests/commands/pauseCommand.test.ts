import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GuildQueue } from 'discord-player';
import { pause } from '../../src/commands/music/pause.js';

function fakeQueue(options: { paused?: boolean; currentTrack?: unknown } = {}) {
  const events: string[] = [];
  let paused = options.paused ?? false;

  const queue = {
    channel: { id: 'voice-1' },
    currentTrack: 'currentTrack' in options ? options.currentTrack : { title: 'One More Time' },
    isPlaying: () => false,
    node: {
      isPaused: () => paused,
      pause: () => {
        paused = true;
        events.push('pause');
      },
      resume: () => {
        paused = false;
        events.push('resume');
      },
    },
  } as unknown as GuildQueue;

  return { queue, events };
}

function fakeInteraction() {
  const replies: any[] = [];
  return {
    replies,
    interaction: {
      guildId: 'guild-pause-test',
      member: { voice: { channel: { id: 'voice-1' }, channelId: 'voice-1' } },
      async reply(payload: any) {
        replies.push(payload);
      },
    },
  };
}

test('/pause pausa durante buffering si hay pista actual aunque no esté sonando', async () => {
  const { queue, events } = fakeQueue();
  const { interaction, replies } = fakeInteraction();

  await pause(interaction, () => queue);

  assert.deepEqual(events, ['pause']);
  assert.equal(replies[0].content, '⏸️ Reproducción pausada.');
  assert.equal(replies[0].flags, 64);
});

test('/pause reanuda cuando la pista actual está pausada', async () => {
  const { queue, events } = fakeQueue({ paused: true });
  const { interaction, replies } = fakeInteraction();

  await pause(interaction, () => queue);

  assert.deepEqual(events, ['resume']);
  assert.equal(replies[0].content, '▶️ Reproducción reanudada.');
  assert.equal(replies[0].flags, 64);
});

test('/pause rechaza la operación si no hay pista actual', async () => {
  const { queue, events } = fakeQueue({ currentTrack: null });
  const { interaction, replies } = fakeInteraction();

  await pause(interaction, () => queue);

  assert.deepEqual(events, []);
  assert.match(replies[0].content, /No hay nada reproduciéndose/);
  assert.equal(replies[0].flags, 64);
});
