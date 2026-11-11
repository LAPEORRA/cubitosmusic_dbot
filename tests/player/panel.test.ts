import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ActionRowBuilder, ButtonBuilder, EmbedBuilder, Message } from 'discord.js';
import { setPanelMessage, updateEmptyPanel, updatePanel } from '../../src/player/panel/panel.js';

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
