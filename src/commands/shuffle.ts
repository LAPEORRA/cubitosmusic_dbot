import { SlashCommandBuilder } from 'discord.js';
import { shuffleQueue, getQueue } from '../player/controls.js';

export const data = new SlashCommandBuilder()
  .setName('shuffle')
  .setDescription('Aleatoriza el orden de la cola');

export async function shuffle(interaction: any) {
  const queue = getQueue(interaction);
  if (!queue) {
    return interaction.reply({ content: '❌ No hay nada reproduciéndose.', flags: 64 });
  }

  if (!shuffleQueue(queue)) {
    return interaction.reply({ content: '📭 No hay canciones en la cola para mezclar.', flags: 64 });
  }

  await interaction.reply({ content: '🔀 Cola mezclada.', flags: 64 });
}