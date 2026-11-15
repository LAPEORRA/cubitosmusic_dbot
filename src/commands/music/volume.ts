import { SlashCommandBuilder } from 'discord.js';
import type { GuildQueue } from 'discord-player';
import {
  getQueue,
  requireSameVoiceChannel,
  requireVoiceChannel,
  setQueueVolume,
} from '../../player/controls.js';
import {
  buildPanelEmbed,
  buildPanelRows,
  getPanelRowState,
  getStartedAt,
  updatePanel,
} from '../../player/panel/panel.js';
import { buildCommandEmbed } from '../../utils/commandEmbed.js';

export const data = new SlashCommandBuilder()
  .setName('volume')
  .setDescription('Ajusta el volumen de reproducción (1-100%)')
  .addIntegerOption((option) =>
    option
      .setName('porcentaje')
      .setDescription('Nivel de volumen entre 1 y 100')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(100),
  );

export async function volume(
  interaction: any,
  resolveQueue: (interaction: any) => GuildQueue | null = getQueue,
) {
  if (!requireVoiceChannel(interaction)) {
    return interaction.reply({ content: '❌ Necesitas estar en un canal de voz.', flags: 64 });
  }

  const queue = resolveQueue(interaction);
  if (!queue || !queue.currentTrack) {
    return interaction.reply({ content: '❌ No hay nada reproduciéndose.', flags: 64 });
  }

  if (!requireSameVoiceChannel(interaction, queue)) {
    return interaction.reply({ content: '❌ Debes estar en el mismo canal de voz que el bot.', flags: 64 });
  }

  const level = interaction.options.getInteger('porcentaje', true) as number;
  if (setQueueVolume(queue, level) === null) {
    return interaction.reply({ content: '❌ El volumen debe estar entre 1 y 100.', flags: 64 });
  }

  const channel = (queue.metadata as any)?.channel;
  if (channel) {
    const embed = buildPanelEmbed(queue.currentTrack, queue, getStartedAt(queue.guild.id));
    const rows = buildPanelRows(queue.node.isPaused(), queue.repeatMode, getPanelRowState(queue));
    await updatePanel(channel, embed, rows);
  }

  await interaction.reply({
    embeds: [buildCommandEmbed({
      author: 'CubitoMusic',
      description: `🔊 Volumen ajustado al **${level}%**.`,
    })],
  });
}
