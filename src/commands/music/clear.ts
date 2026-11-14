import { SlashCommandBuilder } from 'discord.js';
import { clearQueue, getQueue, requireSameVoiceChannel, requireVoiceChannel } from '../../player/controls.js';
import { buildCommandEmbed } from '../../utils/commandEmbed.js';

export const data = new SlashCommandBuilder()
  .setName('clear')
  .setDescription('Vacía la cola de reproducción');

export async function clear(interaction: any) {
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

  if (!clearQueue(queue)) {
    return interaction.reply({ content: '📬 La cola ya está vacía.', flags: 64 });
  }

  return interaction.reply({
    embeds: [buildCommandEmbed({ author: 'CubitoMusic', description: '🗑️ La cola ha sido limpiada.' })],
  });
}
