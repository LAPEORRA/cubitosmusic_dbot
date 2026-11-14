import { SlashCommandBuilder } from 'discord.js';
import { shuffleQueue, requireVoiceChannel, requireSameVoiceChannel, getQueue } from '../../player/controls.js';
import { buildCommandEmbed } from '../../utils/commandEmbed.js';

export const data = new SlashCommandBuilder()
  .setName('shuffle')
  .setDescription('Aleatoriza el orden de la cola');

export async function shuffle(interaction: any) {
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

  if (!shuffleQueue(queue)) {
    return interaction.reply({ content: '📭 No hay canciones en la cola para mezclar.', flags: 64 });
  }

  await interaction.reply({
    embeds: [buildCommandEmbed({ author: 'CubitoMusic', description: '🔀 Cola mezclada.' })],
  });
}