import { SlashCommandBuilder } from 'discord.js';
import { toggleLoop, requireVoiceChannel, requireSameVoiceChannel, getQueue } from '../../player/controls.js';
import { buildCommandEmbed } from '../../utils/commandEmbed.js';

export const data = new SlashCommandBuilder()
  .setName('loop')
  .setDescription('Activa o desactiva la repetición de la canción actual');

export async function loop(interaction: any) {
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

  const mode = toggleLoop(queue);
  await interaction.reply({
    embeds: [buildCommandEmbed({
      author: 'CubitoMusic',
      description: mode ? '🔁 Repetición de canción activada.' : '✅ Repetición desactivada.',
    })],
  });
}