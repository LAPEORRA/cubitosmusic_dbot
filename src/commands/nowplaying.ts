import { SlashCommandBuilder } from 'discord.js';
import { useQueue } from 'discord-player';

export const data = new SlashCommandBuilder()
  .setName('nowplaying')
  .setDescription('Muestra información de la canción actual');

export async function nowplaying(interaction: any) {
  const queue = useQueue(interaction.guildId);

  if (!queue) {
    return interaction.reply({ content: '❌ No hay nada reproduciéndose.', flags: 64 });
  }

  const currentTrack = queue.currentTrack;
  if (!currentTrack) {
    return interaction.reply({ content: '❌ No hay canción actual en la cola.', flags: 64 });
  }

  const progressBar = queue.node.createProgressBar() ?? '⏱';

  await interaction.reply({
    content: `🎵 **${currentTrack.title}** - ${currentTrack.author}\n` +
             `⏱ Progreso: ${progressBar} ${currentTrack.duration}\n` +
             `🔊 Volumen: ${queue.node.volume}%\n` +
             `▶ ${queue.repeatMode ? 'Repitiendo' : 'No repeating'}`,
    flags: 64,
  });
}