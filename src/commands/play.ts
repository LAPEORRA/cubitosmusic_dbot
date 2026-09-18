import { SlashCommandBuilder } from 'discord.js';
import { createAudioPlayer, AudioPlayerStatus } from '@discordjs/voice';
import { Track } from 'discord-player';

export const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Reproduce música desde YouTube, Spotify o URL')
  .addStringOption(option =>
    option.setName('query')
      .setDescription('URL de YouTube, link de Spotify o búsqueda')
      .setRequired(true));

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: false });

  const query = interaction.options.getString('query')!;
  const voiceChannel = interaction.member?.voice.channel;

  if (!voiceChannel) {
    return interaction.editReply({ content: '❌ Necesitas estar en un canal de voz para reproducir música.', ephemeral: true });
  }

  try {
    // Usar el player creado en ready.ts
    const player = (interaction.client as any).player;

    if (!player) {
      return interaction.editReply({ content: '❌ El player no está inicializado.', ephemeral: true });
    }

    // Agregar pista a la cola y reproducir
    const result = await player.play(voiceChannel, query, {
      atOnce: false,
    });

    const track = result.track;

    if (!track) {
      return interaction.editReply({ content: '❌ No se pudo obtener la pista. Verifica la URL.', ephemeral: true });
    }

    await interaction.editReply({ content: `🎵 Ahora reproduciendo: **${track.title}**`, ephemeral: false });

  } catch (error) {
    console.error('❌ Error en /play:', error);
    await interaction.editReply({ content: '❌ Error al procesar la música. Verifica la URL e inténtalo de nuevo.', ephemeral: true });
  }
}

export default { data, execute };