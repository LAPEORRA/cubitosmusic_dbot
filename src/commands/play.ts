import { SlashCommandBuilder, GuildMember } from 'discord.js';
import { Player } from 'discord-player';

export const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Reproduce música desde YouTube, YouTube Music, Spotify o URL')
  .addStringOption(option =>
    option.setName('query')
      .setDescription('URL de YouTube/YouTube Music/Spotify o búsqueda de texto')
      .setRequired(true));

function normalizeUrl(url: string): string {
  // YouTube Music -> YouTube regular (preserva list= si es playlist/mix)
  const ytmusicMatch = url.match(/music\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/);
  if (ytmusicMatch) {
    const listPart = url.match(/&list=([a-zA-Z0-9_-]+)/)?.[1];
    const v = `https://www.youtube.com/watch?v=${ytmusicMatch[1]}`;
    return listPart ? `${v}&list=${listPart}` : v;
  }
  // YouTube Playlist (incluye YouTube Music) -> URL limpia de playlist
  const playlistMatch = url.match(/(?:music\.)?youtube\.com\/playlist\?list=([a-zA-Z0-9_-]+)/);
  if (playlistMatch) {
    return `https://www.youtube.com/playlist?list=${playlistMatch[1]}`;
  }
  // YouTube Video con parametros extra -> URL limpia
  const ytbeMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
  if (ytbeMatch) {
    return `https://www.youtube.com/watch?v=${ytbeMatch[1]}`;
  }
  // YouTube Video sin playlist -> URL limpia (sin parametros extra)
  const ytwatchMatch = url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/);
  if (ytwatchMatch && !url.includes('list=')) {
    return `https://www.youtube.com/watch?v=${ytwatchMatch[1]}`;
  }
  // SoundCloud -> limpiar query parameters
  // No se convierte a on.soundcloud.com: los slugs no son tokens válidos para esa forma
  const soundcloudMatch = url.match(/https?:\/\/soundcloud\.com\/[^?]+/);
  if (soundcloudMatch) {
    return soundcloudMatch[0];
  }
  return url;
}

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