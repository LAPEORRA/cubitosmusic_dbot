import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GuildQueue } from 'discord-player';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { volume } from '../../src/commands/music/volume.js';
import { setPanelMessage } from '../../src/player/panel/panel.js';
import { setQueueVolume } from '../../src/player/controls.js';

type ReplyPayload = {
  content?: string;
  embeds?: Array<{ data: any }>;
  flags?: number;
};

function fakeQueue(options: { currentTrack?: unknown; volume?: number; channelId?: string; guildId?: string } = {}) {
  const guildId = options.guildId ?? 'guild-volume-test';
  const events: string[] = [];
  const edited: any[] = [];
  const stateFile = join(mkdtempSync(join(tmpdir(), 'volume-')), 'panel-state.json');

  const message = {
    editable: true,
    deletable: false,
    components: [],
    async edit(payload: any) {
      edited.push(payload);
      return message;
    },
  };

  setPanelMessage(guildId, message as any, stateFile);

  const queue: any = {
    guild: { id: guildId },
    channel: { id: options.channelId ?? 'voice-1' },
    metadata: { channel: { guildId } },
    currentTrack: 'currentTrack' in options
      ? options.currentTrack
      : { title: 'One More Time', author: 'Daft Punk', duration: '3:45', durationMS: 225_000 },
    repeatMode: 0,
    tracks: { data: [] },
    node: {
      volume: options.volume ?? 70,
      isPaused: () => false,
      getTimestamp: () => null,
      setVolume: (value: number) => {
        queue.node.volume = value;
        events.push(`setVolume:${value}`);
      },
    },
  };

  return { queue: queue as GuildQueue, events, edited };
}

function fakeInteraction(options: { voiceChannelId?: string | null; level?: number } = {}) {
  const replies: ReplyPayload[] = [];
  const voiceChannelId = options.voiceChannelId === undefined ? 'voice-1' : options.voiceChannelId;

  const interaction = {
    guildId: 'guild-volume-test',
    member: voiceChannelId
      ? { voice: { channel: { id: voiceChannelId }, channelId: voiceChannelId } }
      : { voice: { channel: null, channelId: null } },
    options: {
      getInteger: () => options.level ?? 45,
    },
    async reply(payload: ReplyPayload) {
      replies.push(payload);
    },
  };

  return { interaction, replies };
}

test('/volume rechaza si el usuario no está en un canal de voz', async () => {
  const { queue } = fakeQueue();
  const { interaction, replies } = fakeInteraction({ voiceChannelId: null });

  await volume(interaction, () => queue);

  assert.equal(replies[0].flags, 64);
  assert.equal(replies[0].content, '❌ Necesitas estar en un canal de voz.');
});

test('/volume rechaza si no hay reproducción activa', async () => {
  const { queue } = fakeQueue({ currentTrack: null });
  const { interaction, replies } = fakeInteraction();

  await volume(interaction, () => queue);

  assert.equal(replies[0].flags, 64);
  assert.equal(replies[0].content, '❌ No hay nada reproduciéndose.');
});

test('/volume rechaza si el usuario está en otro canal de voz', async () => {
  const { queue } = fakeQueue({ channelId: 'voice-1' });
  const { interaction, replies } = fakeInteraction({ voiceChannelId: 'voice-2' });

  await volume(interaction, () => queue);

  assert.equal(replies[0].flags, 64);
  assert.equal(replies[0].content, '❌ Debes estar en el mismo canal de voz que el bot.');
});

test('/volume rechaza un nivel fuera de rango', async () => {
  const { queue, events } = fakeQueue();
  const { interaction, replies } = fakeInteraction({ level: 0 });

  await volume(interaction, () => queue);

  assert.deepEqual(events, []);
  assert.equal(replies[0].flags, 64);
  assert.equal(replies[0].content, '❌ El volumen debe estar entre 1 y 100.');
});

test('/volume ajusta el volumen, refresca el panel y confirma en público', async () => {
  const { queue, events, edited } = fakeQueue({ volume: 70 });
  const { interaction, replies } = fakeInteraction({ level: 45 });

  await volume(interaction, () => queue);

  assert.deepEqual(events, ['setVolume:45']);
  assert.equal((queue.node as any).volume, 45);

  assert.equal(edited.length, 1, 'el panel se refresca una vez');
  const footer = edited[0].embeds[0].data.footer.text as string;
  assert.match(footer, /Vol 45%/);

  assert.equal(replies[0].flags, undefined, 'la confirmación es pública');
  assert.equal(replies[0].embeds?.[0]?.data.description, '🔊 Volumen ajustado al **45%**.');
});

test('setQueueVolume valida el rango y aplica niveles enteros válidos', () => {
  const calls: number[] = [];
  const queue = { node: { setVolume: (value: number) => calls.push(value) } } as unknown as GuildQueue;

  assert.equal(setQueueVolume(queue, 0), null);
  assert.equal(setQueueVolume(queue, 101), null);
  assert.equal(setQueueVolume(queue, Number.NaN), null);
  assert.equal(setQueueVolume(queue, 1.5), null);
  assert.deepEqual(calls, []);

  assert.equal(setQueueVolume(queue, 1), 1);
  assert.equal(setQueueVolume(queue, 100), 100);
  assert.deepEqual(calls, [1, 100]);
});
