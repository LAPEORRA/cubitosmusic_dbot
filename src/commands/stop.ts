import { SlashCommandBuilder } from 'discord.js';
import { stopQueue, requireVoiceChannel, getQueue } from '../player/controls.js';
import { updateEmptyPanel } from '../player/panel.js';

export const data = new SlashCommandBuilder()
  .setName('stop')
  .setDescription('Detiene la música y desconecta');

export async function stop(interaction: any) {
  if (!requireVoiceChannel(interaction)) {
    return interaction.reply({ content: '❌ Necesitas estar en un canal de voz.', flags: 64 });
  }

  const queue = getQueue(interaction);
  if (!queue) {
    return interaction.reply({ content: '❌ No hay nada reproduciéndose.', flags: 64 });
  }

  await stopQueue(queue);
  const channel = (queue.metadata as any)?.channel as any;
  await updateEmptyPanel(channel);
  await interaction.reply({ content: '⏹️ Música detenida y bot desconectado.', flags: 64 });
}