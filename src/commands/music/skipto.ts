import { SlashCommandBuilder } from 'discord.js';
import { getQueue, requireSameVoiceChannel, requireVoiceChannel, skipTo } from '../../player/controls.js';
import { buildCommandEmbed } from '../../utils/commandEmbed.js';

export const data = new SlashCommandBuilder()
  .setName('skipto')
  .setDescription('Salta directamente a una canción de la cola')
  .addIntegerOption(option =>
    option.setName('posicion')
      .setDescription('Posición en la cola de espera (1 = siguiente pista, ver /queue)')
      .setRequired(true)
      .setMinValue(1));

export async function skipto(interaction: any) {
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

  const target = skipTo(queue, position);
  if (!target) {
    return interaction.reply({ content: '❌ Posición inválida.', flags: 64 });
  }

  return interaction.reply({
    embeds: [buildCommandEmbed({
      author: 'CubitoMusic',
      description: `⏭️ Saltando a **#${position}**: **${target.title}**`,
    })],
  });
}
