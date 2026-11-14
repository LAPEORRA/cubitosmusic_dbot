import { SlashCommandBuilder } from 'discord.js';
import { useQueue } from 'discord-player';
import { buildCommandEmbed } from '../../utils/commandEmbed.js';

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
  const embed = buildCommandEmbed({
    author: 'CubitoMusic',
    title: currentTrack.title,
    url: currentTrack.url,
    thumbnail: currentTrack.thumbnail,
    description: [
      `⏱ Progreso: ${progressBar} ${currentTrack.duration}`,
      `🔊 Volumen: ${queue.node.volume}%`,
      `▶ ${queue.repeatMode ? 'Repitiendo' : 'Sin repetición'}`,
    ].join('\n'),
  });

  await interaction.reply({ embeds: [embed] });
}
