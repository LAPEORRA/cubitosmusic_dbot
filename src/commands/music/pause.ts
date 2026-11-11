import { SlashCommandBuilder } from 'discord.js';
import { togglePause, requireVoiceChannel, requireSameVoiceChannel, getQueue } from '../../player/controls.js';

export const data = new SlashCommandBuilder()
  .setName('pause')
  .setDescription('Pausa o reanuda la reproducción');

export async function pause(interaction: any) {
  if (!requireVoiceChannel(interaction)) {
    return interaction.reply({ content: '❌ Necesitas estar en un canal de voz.', flags: 64 });
  }

  const queue = getQueue(interaction);
  if (!queue || (!queue.isPlaying() && !queue.node.isPaused())) {
    return interaction.reply({ content: '❌ No hay nada reproduciéndose.', flags: 64 });
  }

  if (!requireSameVoiceChannel(interaction, queue)) {
    return interaction.reply({ content: '❌ Debes estar en el mismo canal de voz que el bot.', flags: 64 });
  }

  const nowPaused = togglePause(queue);
  await interaction.reply({ content: nowPaused ? '⏸️ Reproducción pausada.' : '▶️ Reproducción reanudada.', flags: 64 });
}