import { SlashCommandBuilder, GuildMember } from 'discord.js';
import { Player, useQueue } from 'discord-player';
import { normalizeUrl } from '../../player/url.js';
import { canPlayInChannel } from '../../player/controls.js';
import { buildCommandEmbed } from '../../utils/commandEmbed.js';
import { logRow, traceEvent } from '../../utils/logger.js';

const GENERIC_PLAY_ERROR = '❌ No se pudo cargar esa pista o playlist. Verifica el enlace o intenta con otra búsqueda.';

/**
 * Modo de bajo consumo para la e2-micro (0.25 vCPU).
 *
 * Desactiva los transformadores PCM que operan muestra a muestra (compresor,
 * reverb, ecualizador y biquads). El volumen se mantiene: es un transformador
 * nativo barato y sin él `/volume` dejaría de funcionar.
 */
const LOW_CPU_AUDIO = process.env.LOW_CPU_AUDIO === 'true';

/**
 * `yt-dlp` puede tardar 30-60 s en resolver una pista desde una IP de GCP
 * cuando YouTube aplica rate-limit. 30 s abortaba `/play` a mitad de resolución.
 */
const PLAY_TIMEOUT_MS = 90_000;

/**
 * Mensaje seguro para Discord: no reenvía `error.message` crudo de yt-dlp/extractores
 * (suelen incluir trazas largas). Conserva los avisos específicos de timeout.
 */
function playErrorMessage(error: any): string {
  if (error?.name === 'AbortError' || error?.message === 'Cancelled') {
    return '⏳ La operación tardó demasiado. Intenta de nuevo.';
  }
  if (error?.message?.includes('Tiempo de espera agotado')) {
    return error.message;
  }
  return GENERIC_PLAY_ERROR;
}

export const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Reproduce música desde YouTube, YouTube Music, Spotify o URL')
  .addStringOption(option =>
    option.setName('query')
      .setDescription('URL de YouTube/YouTube Music/Spotify o búsqueda de texto')
      .setRequired(true));

export async function play(interaction: any, player: Player) {
  const deferStartedAt = performance.now();
  try {
    await interaction.deferReply();
  } catch {
    traceEvent('timing', 'play_defer_reply', {
      interactionId: interaction.id,
      deferMs: performance.now() - deferStartedAt,
      succeeded: false,
    });
    return;
  }
  traceEvent('timing', 'play_defer_reply', {
    interactionId: interaction.id,
    deferMs: performance.now() - deferStartedAt,
    succeeded: true,
  });

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
    // Timeout para evitar que player.play() se quede bloqueado en el AsyncQueue.
    // 90 s: la resolución de yt-dlp desde GCP puede superar los 30 s.
    const signal = AbortSignal.timeout(PLAY_TIMEOUT_MS);

    const extractStartedAt = performance.now();
    let result;
    try {
      result = await player.play(channel, normalized, {
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
          // En LOW_CPU_AUDIO los transformadores PCM por muestra se apagan;
          // el preset de audioPreset.ts tampoco se aplica en ese modo.
          disableCompressor: LOW_CPU_AUDIO,
          disableReverb: LOW_CPU_AUDIO,
          disableEqualizer: LOW_CPU_AUDIO,
          disableBiquad: LOW_CPU_AUDIO,
        },
      });
    } finally {
      traceEvent('timing', 'play_extract', {
        interactionId: interaction.id,
        extractMs: performance.now() - extractStartedAt,
        normalized,
        searchEngine: searchEngine ?? null,
        lowCpuAudio: LOW_CPU_AUDIO,
        tracksReturned: result?.searchResult?.tracks.length ?? (result?.track ? 1 : 0),
      });
    }

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

    const playlist = result.searchResult?.playlist;
    const activeQueue = useQueue(interaction.guildId);
    // Cola en espera: excluye la pista que ya está sonando (mismo criterio que el footer del panel)
    const waitingCount = activeQueue?.tracks.size ?? Math.max(0, (result.searchResult?.tracks.length ?? 1) - 1);
    const queueLabel = `${waitingCount} ${waitingCount === 1 ? 'canción' : 'canciones'}`;
    const addedLabel = playlist
      ? `${result.searchResult?.tracks.length ?? 1} canciones`
      : result.track.duration || '—';

    await interaction.editReply({
      embeds: [buildCommandEmbed({
        author: playlist ? 'Playlist añadida a la cola' : 'Añadida a la cola',
        title: playlist ? playlist.title : result.track.title,
        url: playlist ? playlist.url : result.track.url,
        thumbnail: playlist ? playlist.thumbnail : result.track.thumbnail,
        description: `${addedLabel} • Cola: ${queueLabel} • Pedida por <@${interaction.user.id}>`,
      })],
    });
  } catch (error: any) {
    logRow({
      badge: 'ERROR',
      color: 'red',
      channel: voiceChannel.name,
      detail: `Error en /play: ${error?.message ?? String(error)}`,
    });
    await interaction.editReply({ content: playErrorMessage(error), flags: 64 }).catch(() => {});
  }
}