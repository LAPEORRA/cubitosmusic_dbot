import { SlashCommandBuilder } from 'discord.js';
import { getQueue, removeTrack, requireSameVoiceChannel, requireVoiceChannel } from '../../player/controls.js';

export const data = new SlashCommandBuilder()
  .setName('remove')
  .setDescription('Elimina una canción de la cola por su posición')
  .addIntegerOption(option =>
    option.setName('posicion')
      .setDescription('Posición de la canción en la cola (empezando en 1)')
      .setRequired(true)
      .setMinValue(1));

export async function remove(interaction: any) {
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

  const position = interaction.options.getInteger('posicion', true) as number;
  if (position > queue.tracks.size) {
    return interaction.reply({ content: '❌ Posición inválida.', flags: 64 });
  }

  const track = removeTrack(queue, position);
  if (!track) {
    return interaction.reply({ content: '❌ Posición inválida.', flags: 64 });
  }

  return interaction.reply({ content: `🗑️ Eliminada: **${track.title}**`, flags: 64 });
}
