import { SlashCommandBuilder } from 'discord.js';
import { Player, useQueue } from 'discord-player';

export const data = new SlashCommandBuilder()
  .setName('queue')
  .setDescription('Muestra la cola de reproducción');

export async function queue(interaction: any, player: Player) {
  const queue = useQueue(interaction.guildId);
  if (!queue || !queue.tracks.data.length) {
    if (!interaction.replied) {
      return interaction.reply({ content: '📭 No hay canciones en la cola.', flags: 64 });
    }
    return;
  }

  const tracks = queue.tracks.data;
  const current = queue.currentTrack;
  const list = tracks
    .slice(0, 10)
    .map((t, i) => `${i + 1}. **${t.title}** — ${t.author}`)
    .join('\n');

  const reply = [];
  if (current) reply.push(`🎵 **Ahora:** ${current.title}\n`);
  reply.push(`📋 **Cola (${tracks.length}):**\n${list}`);
  if (tracks.length > 10) reply.push(`\n... y ${tracks.length - 10} más`);

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({ content: reply.join('\n'), flags: 64 });
  } else {
    await interaction.reply({ content: reply.join('\n'), flags: 64 });
  }
}
