import { SlashCommandBuilder } from 'discord.js';
import { stopQueue, requireVoiceChannel, requireSameVoiceChannel, getQueue } from '../../player/controls.js';
import { updateEmptyPanel } from '../../player/panel/panel.js';
import { buildCommandEmbed } from '../../utils/commandEmbed.js';

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

  if (!requireSameVoiceChannel(interaction, queue)) {
    return interaction.reply({ content: '❌ Debes estar en el mismo canal de voz que el bot.', flags: 64 });
  }

  // Capturado antes del borrado: `queue.delete()` limpia `queue.metadata`.
  const channel = (queue.metadata as any)?.channel as any;
  await stopQueue(queue);
  await updateEmptyPanel(channel);
  await interaction.reply({
    embeds: [buildCommandEmbed({ author: 'CubitoMusic', description: '⏹️ Música detenida y bot desconectado.' })],
  });
}