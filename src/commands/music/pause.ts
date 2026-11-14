import { SlashCommandBuilder } from 'discord.js';
import type { GuildQueue } from 'discord-player';
import { togglePause, requireVoiceChannel, requireSameVoiceChannel, getQueue } from '../../player/controls.js';
import { buildCommandEmbed } from '../../utils/commandEmbed.js';

export const data = new SlashCommandBuilder()
  .setName('pause')
  .setDescription('Pausa o reanuda la reproducción');

export async function pause(
  interaction: any,
  resolveQueue: (interaction: any) => GuildQueue | null = getQueue,
) {
  if (!requireVoiceChannel(interaction)) {
    return interaction.reply({ content: '❌ Necesitas estar en un canal de voz.', flags: 64 });
  }

  const queue = resolveQueue(interaction);
  // Misma condición que `panel_pause`: basta con que haya pista actual para
  // permitir pausar/reanudar durante transiciones (buffering).
  if (!queue || !queue.currentTrack) {
    return interaction.reply({ content: '❌ No hay nada reproduciéndose.', flags: 64 });
  }

  if (!requireSameVoiceChannel(interaction, queue)) {
    return interaction.reply({ content: '❌ Debes estar en el mismo canal de voz que el bot.', flags: 64 });
  }

  const nowPaused = togglePause(queue);
  await interaction.reply({
    embeds: [buildCommandEmbed({
      author: 'CubitoMusic',
      description: nowPaused ? '⏸️ Reproducción pausada.' : '▶️ Reproducción reanudada.',
    })],
  });
}