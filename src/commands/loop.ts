import { SlashCommandBuilder } from 'discord.js';
import { toggleLoop, getQueue } from '../player/controls.js';

export const data = new SlashCommandBuilder()
  .setName('loop')
  .setDescription('Activa o desactiva la repetición de la canción actual');

export async function loop(interaction: any) {
  const queue = getQueue(interaction);
  if (!queue) {
    return interaction.reply({ content: '❌ No hay nada reproduciéndose.', flags: 64 });
  }

  const mode = toggleLoop(queue);
  await interaction.reply({ content: mode ? '🔁 Repetición de canción activada.' : '✅ Repetición desactivada.', flags: 64 });
}