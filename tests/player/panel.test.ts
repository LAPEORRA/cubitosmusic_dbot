import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  Message,
} from 'discord.js';
import type { GuildQueue, Track } from 'discord-player';
import {
  buildPanelEmbed,
  buildPanelRows,
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

function buttonIds(row: ActionRowBuilder<ButtonBuilder>): Array<string | undefined> {
  return row.components.map((button) => (button.data as { custom_id?: string }).custom_id);
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
    [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('panel_pause').setLabel('Pausar').setStyle(1),
      ),
    ],
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

test('buildPanelRows devuelve dos filas con los controles y los botones nuevos', () => {
  const rows = buildPanelRows(false);
  assert.equal(rows.length, 2);

  const ids = rows.map(buttonIds);
  assert.deepEqual(ids[0], ['panel_back', 'panel_pause', 'panel_skip', 'panel_stop', 'panel_queue']);
  assert.deepEqual(ids[1], ['panel_loop', 'panel_shuffle']);
});

test('el botón loop se marca en Success con repeatMode distinto de 0', () => {
  const [, active] = buildPanelRows(false, 1);
  assert.deepEqual(buttonIds(active), ['panel_loop', 'panel_shuffle']);
  assert.equal(active.components[0].data.style, ButtonStyle.Success);
  assert.equal(active.components[1].data.style, ButtonStyle.Secondary);

  const [, idle] = buildPanelRows(false, 0);
  assert.equal(idle.components[0].data.style, ButtonStyle.Secondary);
});

test('updateEmptyPanel deshabilita los botones de todas las filas', async () => {
  const guildId = `panel-empty-${Date.now()}-${Math.random()}`;
  let edited: any;

  const apiRow = (customIds: string[]) => ({
    type: ComponentType.ActionRow,
    components: customIds.map((customId) => ({
      type: ComponentType.Button,
      custom_id: customId,
      style: ButtonStyle.Secondary,
    })),
  });

  const message = {
    editable: true,
    deletable: false,
    components: [
      apiRow(['panel_pause', 'panel_skip']),
      apiRow(['panel_loop', 'panel_shuffle']),
    ],
    async edit(payload: unknown) {
      edited = payload;
      return message;
    },
  } as unknown as Message;

  setPanelMessage(guildId, message);
  await updateEmptyPanel({ guildId });

  assert.equal(edited.components.length, 2);
  const disabled = edited.components.flatMap((row: any) =>
    row.components.map((component: any) => component.data.disabled),
  );
  assert.deepEqual(disabled, [true, true, true, true]);
});
