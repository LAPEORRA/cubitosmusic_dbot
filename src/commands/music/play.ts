import { SlashCommandBuilder, GuildMember } from 'discord.js';
import { Player, useQueue } from 'discord-player';
import { normalizeUrl } from '../../player/url.js';
import { canPlayInChannel } from '../../player/controls.js';

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

  // El bot solo puede reproducir en un canal: si ya tiene cola en otro, el usuario debe unirse.
  const existingQueue = useQueue(interaction.guildId);
  const botChannelId = existingQueue?.channel?.id ?? null;
  if (!canPlayInChannel(botChannelId, voiceChannel.id)) {
    return interaction.editReply({
      content: `❌ Ya estoy reproduciendo en <#${botChannelId}>. Únete a ese canal para usar /play.`,
      flags: 64,
    });
  }

  const channel = voiceChannel as any;

  try {
    // Timeout para evitar que player.play() se quede bloqueado en el AsyncQueue
    // 30s para permitir la resolución de playlists largas
    const signal = AbortSignal.timeout(30_000);

    const result = await player.play(channel, normalized, {
      requestedBy: interaction.user, // Metadatos por pista: cada canción conserva a su solicitante
      signal,
      searchEngine,
      nodeOptions: {
        metadata: { channel: interaction.channel },
        leaveOnEmpty: true,           // Desconectar si la cola queda vacía...
        leaveOnEmptyCooldown: 300_000, // ...tras 5 minutos de inactividad
        leaveOnEnd: true,             // Desconectar cuando termina la cola...
        leaveOnEndCooldown: 300_000,   // ...tras 5 minutos
        leaveOnStop: false,     // No desconectar al usar /stop (lo gestiona el comando)
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

    // La caché de búsquedas (5 h) puede reutilizar pistas con el solicitante anterior;
    // refrescamos el usuario en todas las pistas recién encoladas.
    for (const track of result.searchResult?.tracks ?? []) {
      track.requestedBy = interaction.user;
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