import { SlashCommandBuilder } from 'discord.js';
import { skipTrack, requireVoiceChannel, requireSameVoiceChannel, getQueue } from '../../player/controls.js';
import { buildCommandEmbed } from '../../utils/commandEmbed.js';

export const data = new SlashCommandBuilder()
  .setName('skip')
  .setDescription('Siguiente pista');

export async function skip(interaction: any) {
  if (!requireVoiceChannel(interaction)) {
    return interaction.reply({ content: '❌ Necesitas estar en un canal de voz.', flags: 64 });
  }

  const queue = getQueue(interaction);
  if (!queue) {
    return interaction.reply({ content: '❌ No hay nada reproduciéndose.', flags: 64 });
  }

  if (!requireSameVoiceChannel(interaction, queue)) {
    return interaction.reply({ content: '❌ Debes estar en el mismo canal de voz que el bot.', flags: 64 });
  }

  if (!skipTrack(queue)) {
    return interaction.reply({ content: '❌ No hay nada reproduciéndose.', flags: 64 });
  }

  await interaction.reply({
    embeds: [buildCommandEmbed({ author: 'CubitoMusic', description: '⏭️ Pista saltada.' })],
  });
}