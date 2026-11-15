import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GuildQueue } from 'discord-player';
import { handlePanelButton } from '../../src/player/panel/panel-buttons.js';

function createButtonInteraction(customId: string, deferUpdate: () => Promise<void>) {
  const replies: any[] = [];
  const followUps: any[] = [];
  return {
    replies,
    followUps,
    interaction: {
      guildId: 'guild-buttons',
      customId,
      channel: { name: 'musica' },
      member: { voice: { channel: { id: 'voice-1' }, channelId: 'voice-1' } },
      reply: async (payload: any) => {
        replies.push(payload);
      },
      deferUpdate,
      followUp: async (payload: any) => {
        followUps.push(payload);
      },
    },
  };
}

function fakeActiveQueue(): GuildQueue {
  return {
    channel: { id: 'voice-1' },
    currentTrack: {
      title: 'One More Time',
      author: 'Daft Punk',
      thumbnail: 'https://example.com/cover.jpg',
    },
    repeatMode: 0,
    node: { isPaused: () => false },
    tracks: {
      data: [{ title: 'Around the World', author: 'Daft Punk', duration: '07:09' }],
      shuffle: () => {},
    },
  } as unknown as GuildQueue;
}

test('los botones responden con flags: 64 sin ephemeral (deprecado)', async () => {
  const { interaction, followUps } = createButtonInteraction('panel_queue', async () => {});

  const originalLog = console.log;
  console.log = () => {};
  try {
    await handlePanelButton(interaction, fakeActiveQueue);
  } finally {
    console.log = originalLog;
  }

  assert.equal(followUps.length, 1);
  assert.equal(followUps[0].flags, 64);
  assert.equal('ephemeral' in followUps[0], false);
  assert.equal(followUps[0].content, undefined);
  assert.deepEqual(followUps[0].allowedMentions, { parse: [] });
  const embed = followUps[0].embeds[0].data;
  assert.equal(embed.color, 0x5865f2);
  assert.equal(embed.title, '📋 Cola de reproducción');
  assert.match(embed.description, /Cola \(1\):\*\*\n1\. \*\*Around the World\*\* — Daft Punk `07:09`/);
  assert.equal(embed.thumbnail.url, 'https://example.com/cover.jpg');
  assert.equal(embed.footer.text, '1 canción en espera');
});

test('el aviso de canal de voz tampoco usa ephemeral', async () => {
  const replies: any[] = [];
  const interaction = {
    guildId: 'guild-buttons',
    customId: 'panel_pause',
    channel: { name: 'musica' },
    member: { voice: { channel: null } },
    reply: async (payload: any) => {
      replies.push(payload);
    },
  };

  await handlePanelButton(interaction, fakeActiveQueue);

  assert.equal(replies.length, 1);
  assert.equal(replies[0].flags, 64);
  assert.equal('ephemeral' in replies[0], false);
});

test('el log [BOTÓN] se emite después de deferUpdate', async () => {
  const order: string[] = [];
  const { interaction } = createButtonInteraction('panel_queue', async () => {
    order.push('defer');
  });

  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    if (args.join(' ').includes('BOTÓN')) order.push('log');
  };
  try {
    await handlePanelButton(interaction, fakeActiveQueue);
  } finally {
    console.log = originalLog;
  }

  assert.deepEqual(order, ['defer', 'log']);
});

test('si deferUpdate falla no se emite el log [BOTÓN]', async () => {
  const { interaction } = createButtonInteraction('panel_pause', async () => {
    throw Object.assign(new Error('Unknown interaction'), { code: 10062 });
  });

  const logs: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => logs.push(args.join(' '));
  try {
    await assert.rejects(() => handlePanelButton(interaction, fakeActiveQueue));
  } finally {
    console.log = originalLog;
  }

  assert.equal(logs.some((line) => line.includes('BOTÓN')), false);
});
