import { SlashCommandBuilder } from 'discord.js';
import { skipTrack, requireVoiceChannel, getQueue } from '../player/controls.js';

export const data = new SlashCommandBuilder()
  .setName('skip')
  .setDescription('Siguiente pista');

export async function skip(interaction: any) {
  if (!requireVoiceChannel(interaction)) {
    return interaction.reply({ content: '❌ Necesitas estar en un canal de voz.', flags: 64 });
  }

  const queue = getQueue(interaction);
  if (!queue || !skipTrack(queue)) {
    return interaction.reply({ content: '❌ No hay nada reproduciéndose.', flags: 64 });
  }

  await interaction.reply({ content: '⏭️ Pista saltada.', flags: 64 });
}