import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ActionRowBuilder, ButtonBuilder, EmbedBuilder, Message } from 'discord.js';
import type { GuildQueue, Track } from 'discord-player';
import {
  buildPanelEmbed,
  setPanelMessage,
  updateEmptyPanel,
  updatePanel,
} from '../../src/player/panel/panel.js';

function fakeQueue(volume = 70): GuildQueue {
  return {
    node: { createProgressBar: () => '0:00 / 3:00', volume },
    tracks: { data: [] },
  } as unknown as GuildQueue;
}

function fakeTrack(requestedBy: unknown = null): Track {
  return {
    title: 'One More Time',
    url: 'https://example.com/track',
    author: 'Daft Punk',
    thumbnail: 'https://example.com/thumb.jpg',
    duration: '3:45',
    requestedBy,
  } as unknown as Track;
}

function embedField(embed: EmbedBuilder, name: string): string | undefined {
  return embed.data.fields?.find((field) => field.name === name)?.value;
}

test('an empty-queue panel update is not overwritten by a pending playback update', async () => {
  const guildId = `panel-test-${Date.now()}`;
  let description: string | undefined;
  let title: string | undefined;

  const message = {
    editable: true,
    deletable: false,
    components: [],
    async edit(payload: { embeds: EmbedBuilder[] }) {
      await Promise.resolve();
      description = payload.embeds[0].data.description;
      title = payload.embeds[0].data.title;
      return message;
    },
  } as unknown as Message;

  setPanelMessage(guildId, message);

  const activeUpdate = updatePanel(
    { guildId },
    new EmbedBuilder().setTitle('Reproduciendo'),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('panel_pause').setLabel('Pausar').setStyle(1),
    ),
  );
  const emptyUpdate = updateEmptyPanel({ guildId });

  await Promise.all([activeUpdate, emptyUpdate]);

  assert.equal(description, '📭 **Cola vacía** — la reproducción terminó.');
  assert.equal(title, undefined);
});

test('el panel prioriza al solicitante de la pista actual sobre el fallback de la cola', () => {
  const embed = buildPanelEmbed(
    fakeTrack({ username: 'nuevo-usuario' }),
    fakeQueue(),
    new Date(),
    'usuario-viejo',
  );
  assert.equal(embedField(embed, '👤 Solicitada por'), 'nuevo-usuario');
});

test('el panel usa el fallback solo si la pista no tiene solicitante', () => {
  const embed = buildPanelEmbed(fakeTrack(null), fakeQueue(), new Date(), 'usuario-viejo');
  assert.equal(embedField(embed, '👤 Solicitada por'), 'usuario-viejo');
});

test('el panel muestra Desconocido sin solicitante ni fallback', () => {
  const embed = buildPanelEmbed(fakeTrack(null), fakeQueue(), new Date());
  assert.equal(embedField(embed, '👤 Solicitada por'), 'Desconocido');
});

test('el panel no anuncia /resume en los comandos', () => {
  const embed = buildPanelEmbed(fakeTrack(), fakeQueue(), new Date());
  const commands = embedField(embed, '🛠 Comandos') ?? '';
  assert.ok(!commands.includes('/resume'), `no debe mencionar /resume: ${commands}`);
  assert.ok(commands.includes('`/play <url|búsqueda>` | `/pause`'));
});
