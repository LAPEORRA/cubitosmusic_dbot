import { SlashCommandBuilder, GuildMember } from 'discord.js';
import { Player } from 'discord-player';
import { normalizeUrl } from '../../player/url.js';

export const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Reproduce música desde YouTube, YouTube Music, Spotify o URL')
  .addStringOption(option =>
    option.setName('query')
      .setDescription('URL de YouTube/YouTube Music/Spotify o búsqueda de texto')
      .setRequired(true));

export async function play(interaction: any, player: Player) {
  try {
    await interaction.deferReply({ flags: 64 });
  } catch {
    return;
  }

  const rawQuery = interaction.options.getString('query')!;
  const normalized = normalizeUrl(rawQuery);

  // Forzar extractor por URL usando searchEngine
  const searchEngine = normalized.includes('youtube.com')
    ? 'ext:com.dfxphoenix.youtubedlp-extractor'
    : normalized.includes('spotify.com')
    ? 'ext:com.discord-player.spotifyextractor'
    : normalized.includes('soundcloud.com')
    ? 'ext:com.discord-player.soundcloudextractor'
    : undefined;

  const member = interaction.member as GuildMember;
  const voiceChannel = member.voice.channel;

  if (!voiceChannel) {
    return interaction.editReply({ content: '❌ Necesitas estar en un canal de voz.', flags: 64 });
  }

  const channel = voiceChannel as any;

  try {
    // Timeout para evitar que player.play() se quede bloqueado en el AsyncQueue
    // 30s para permitir la resolución de playlists largas
    const signal = AbortSignal.timeout(30_000);

    const result = await player.play(channel, normalized, {
      signal,
      searchEngine,
      nodeOptions: {
        metadata: { channel: interaction.channel, requestedBy: interaction.user },
        leaveOnEmpty: false,    // No desconectar si la cola está vacía
        leaveOnEnd: false,      // No desconectar cuando termina la pista
        leaveOnStop: false,     // No desconectar al usar /stop
        verifyFallbackStream: true,
        volume: 70, // Reducir volumen base para evitar saturación
      },
    });

    // Validación completa: verificar que result y result.track existan
    if (!result) {
      await interaction.editReply({ content: '❌ Error: El bot no pudo conectar con el extractor.', flags: 64 });
      return;
    }
    
    if (!result.track) {
      await interaction.editReply({ content: '❌ Error: No se pudo obtener la pista de audio.', flags: 64 });
      return;
    }

    await interaction.editReply({
      content: result.searchResult?.playlist
        ? `🎵 **${result.searchResult.playlist.title}** — ${result.searchResult.tracks.length} canciones añadidas a la cola.`
        : `🎵 Reproduciendo: **${result.track.title}**`,
      flags: 64,
    });
  } catch (error: any) {
    console.error('Error en /play:', error);
    if (error.name === 'AbortError' || error.message === 'Cancelled') {
      await interaction.editReply({ content: '⏳ La operación tardó demasiado. Intenta de nuevo.', flags: 64 }).catch(() => {});
    } else if (error.message?.includes('Tiempo de espera agotado')) {
      await interaction.editReply({ content: error.message, flags: 64 }).catch(() => {});
    } else {
      await interaction.editReply({ content: `❌ Error: ${error.message || 'No se pudo reproducir.'}`, flags: 64 }).catch(() => {});
    }
  }
}