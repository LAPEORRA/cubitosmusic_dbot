import { randomUUID } from 'node:crypto';
import { ActivityType, Client } from 'discord.js';
import type { GuildQueue, Player, Track } from 'discord-player';
import { buildPanelEmbed, buildPanelRows, getPanelRowState, updatePanel, setStartedAt, getStartedAt, updateEmptyPanel, cleanupOrphanedPanels } from '../player/panel/panel.js';
import { enableAudioPreset } from '../player/audioPreset.js';
import { applyInitialVolume, getDesiredVolume, reapplyVolumeWhenPlaying } from '../player/controls.js';
import {
  getSystemMetrics,
  logRow,
  printStartupBanner,
  serializeError,
  summarizePlayerError,
  traceEvent,
  type LogColor,
} from '../utils/logger.js';

const playbackSessionIds = new WeakMap<GuildQueue, string>();
const tracedDispatchers = new WeakSet<object>();
const ERROR_LOG_DEDUP_WINDOW_MS = 2_000;
const recentErrorLogSignatures = new Map<string, number>();

export function createTrackLoadTimer(now: () => number = () => performance.now()) {
  const startedAtByTrack = new WeakMap<Track, number>();

  return {
    start(track: Track): void {
      startedAtByTrack.set(track, now());
    },
    consume(track: Track): number | undefined {
      const startedAt = startedAtByTrack.get(track);
      startedAtByTrack.delete(track);
      return startedAt === undefined ? undefined : now() - startedAt;
    },
  };
}

const trackLoadTimer = createTrackLoadTimer();

function isDuplicateErrorLog(guildId: string, trackTitle: string, errorText: string): boolean {
  const now = Date.now();
  for (const [signature, loggedAt] of recentErrorLogSignatures) {
    if (now - loggedAt >= ERROR_LOG_DEDUP_WINDOW_MS) {
      recentErrorLogSignatures.delete(signature);
    }
  }

  const signature = `${guildId}:${trackTitle}:${errorText}`;
  const loggedAt = recentErrorLogSignatures.get(signature);
  if (loggedAt !== undefined && now - loggedAt < ERROR_LOG_DEDUP_WINDOW_MS) return true;

  recentErrorLogSignatures.set(signature, now);
  return false;
}

function traceQueueStateChanges(queue: GuildQueue): void {
  const dispatcher = queue.dispatcher;
  if (!dispatcher || tracedDispatchers.has(dispatcher)) return;
  tracedDispatchers.add(dispatcher);

  const guildId = queue.guild.id;
  dispatcher.audioPlayer.on('stateChange', (from, to) => {
    traceEvent('audio', 'state_change', {
      guildId,
      from: from.status.toLowerCase().replace(/-/g, ''),
      to: to.status.toLowerCase().replace(/-/g, ''),
    });
  });

  dispatcher.voiceConnection.on('stateChange', (from, to) => {
    traceEvent('voice', 'state_change', {
      guildId,
      from: from.status.toLowerCase().replace(/-/g, ''),
      to: to.status.toLowerCase().replace(/-/g, ''),
    });
  });
}

function getPlaybackSessionId(queue: GuildQueue): string {
  let sessionId = playbackSessionIds.get(queue);
  if (!sessionId) {
    sessionId = randomUUID();
    playbackSessionIds.set(queue, sessionId);
  }
  return sessionId;
}

function getTrackDetails(track: Track) {
  return {
    trackId: track.id,
    title: track.title,
    duration: track.duration,
    source: track.source,
    extractor: track.extractor?.identifier ?? null,
  };
}

function getTraceTrackDetails(track?: Track | null) {
  return {
    title: track?.title ?? null,
    url: track?.url ?? null,
    source: track?.source ?? null,
    extractor: track?.extractor?.identifier ?? null,
  };
}

function getErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return { errorName: error.name, errorMessage: error.message };
  }
  return { errorMessage: String(error) };
}

/** Refresca el panel cuando cambia la cola sin cambiar la pista actual. */
function refreshQueuePanel(queue: GuildQueue): void {
  const channel = (queue.metadata as any)?.channel as any;
  const current = queue.currentTrack;
  if (!channel || !current) return;

  const embed = buildPanelEmbed(current, queue, getStartedAt(queue.guild.id));
  const rows = buildPanelRows(queue.node.isPaused(), queue.repeatMode, getPanelRowState(queue));
  void updatePanel(channel, embed, rows);
}

export function logTracksQueued(queue: GuildQueue, tracks: Track[]) {
  const preview = tracks.slice(0, 5).map((track) => track.title);

  // Resumen ligero: el switch necesita títulos/playlist, pero no queremos el Track
  // completo en `rawJson` (objetos grandes y con referencias internas).
  const summaries = tracks.map((track) => ({
    title: track.title,
    duration: track.duration,
    playlist: track.playlist
      ? { title: track.playlist.title, source: track.playlist.source }
      : null,
  }));

  logPlaybackEvent('tracks_queued', queue, {
    tracks: summaries,
    tracksAdded: tracks.length,
    queueSize: queue.tracks.size,
    playlist: tracks[0]?.playlist
      ? {
          title: tracks[0].playlist.title,
          source: tracks[0].playlist.source,
          totalTracks: tracks.length,
          preview,
          omittedPreviewTracks: Math.max(0, tracks.length - preview.length),
        }
      : null,
    track: tracks.length === 1 ? getTrackDetails(tracks[0]) : undefined,
  });
}

function logPlaybackEvent(
  event: string,
  queue: GuildQueue,
  details: Record<string, unknown> = {},
  client?: Client,
) {
  const sessionId = String(details.sessionId ?? getPlaybackSessionId(queue));
  const metrics = getSystemMetrics(client);
  const channel = queue.channel?.name ?? null;

  let badge = 'INFO';
  let color: LogColor = 'gray';
  let detail = '';
  let errorText = '';
  let failedTrackTitle = '';
  let metricsText = metrics;
  const rawJson: Record<string, unknown> = { event, ...details };

  switch (event) {
    case 'queue_created': {
      const presetActive = Boolean(details.presetActive);
      badge = 'SESIÓN';
      color = 'blue';
      detail = `Sesión ${sessionId.slice(0, 6)} • Preset: ${presetActive ? 'activo' : 'off'}`;
      break;
    }
    case 'tracks_queued': {
      badge = '+COLA';
      color = 'cyan';
      const tracks = Array.isArray(details.tracks)
        ? (details.tracks as Track[])
        : [details.track as Track].filter(Boolean) as Track[];
      const first = tracks[0];
      detail = tracks.length > 1
        ? first?.playlist?.title
          ? `Playlist: ${first.playlist.title} (+${tracks.length} pistas)`
          : `Playlist añadida (+${tracks.length} pistas)`
        : first
          ? `${first.title} • ${first.duration ?? 'n/a'}`
          : 'Cola actualizada';
      metricsText = `En cola: ${queue.tracks.size}`;
      break;
    }
    case 'playback_started': {
      const track = (queue.currentTrack ?? details.track) as Track;
      badge = '▶ PLAY';
      color = 'green';
      detail = `${track?.title ?? '—'} (${track?.duration ?? 'n/a'})`;
      const cargaMs = typeof details.cargaMs === 'number' ? details.cargaMs : 0;
      const sequence = queue.history.tracks.size + 1;
      metricsText = `Carga: ${(cargaMs / 1000).toFixed(1)}s • #${sequence} • ${getSystemMetrics(client)}`;
      break;
    }
    case 'player_pause': {
      const track = queue.currentTrack;
      badge = 'PAUSA';
      color = 'yellow';
      detail = track ? `${track.title} (${track.duration ?? 'n/a'})` : '—';
      break;
    }
    case 'player_resume': {
      const track = queue.currentTrack;
      badge = 'REANUDA';
      color = 'green';
      detail = track ? `${track.title} (${track.duration ?? 'n/a'})` : '—';
      break;
    }
    case 'queue_empty': {
      badge = 'VACÍA';
      color = 'magenta';
      detail = 'Cola finalizada';
      metricsText = `Total sesión: ${queue.history.tracks.size} temas`;
      break;
    }
    case 'queue_deleted': {
      badge = 'STOP';
      color = 'gray';
      detail = 'Sesión de reproducción cerrada';
      break;
    }
    case 'player_error':
    case 'playback_error': {
      badge = event === 'playback_error' ? 'ERR AUDIO' : 'ERROR';
      color = 'red';
      errorText = typeof details.error === 'object' && details.error !== null
        ? getErrorDetails(details.error).errorMessage
        : String(details.error ?? details.errorMessage ?? 'Error de reproducción');
      errorText = summarizePlayerError(errorText);
      const failedTrack = queue.currentTrack;
      failedTrackTitle = failedTrack?.title ?? '—';
      detail = failedTrack ? `${failedTrack.title}: ${errorText}` : errorText;
      break;
    }
    default: {
      badge = 'INFO';
      color = 'gray';
      detail = event;
      break;
    }
  }

  if (
    (event === 'player_error' || event === 'playback_error') &&
    isDuplicateErrorLog(queue.guild.id, failedTrackTitle, errorText)
  ) {
    return;
  }

  logRow({
    badge,
    color,
    channel,
    detail: String(detail),
    metrics: metricsText,
    rawJson,
  });
}

export const ready = async (client: Client, player: Player, guildId: string, spotifyEnabled = false) => {
  let guildName = '—';
  try {
    const guild = await client.guilds.fetch(guildId);
    guildName = guild.name;
  } catch {
    // El banner se imprime igualmente con el fallback de nombre
  }

  printStartupBanner({
    botTag: client.user?.tag ?? 'CubitoMusic',
    guildName,
    spotifyEnabled,
    extractorCount: player.extractors.store.size,
    client,
  });

  void cleanupOrphanedPanels(client);

  player.events.on('queueCreate', (queue) => {
    const sessionId = getPlaybackSessionId(queue);
    // `queueCreate` ocurre antes de crear el `AudioResource`: aquí no hay dispatcher,
    // así que el compresor se aplica de verdad en `playerStart`. El log refleja la
    // intención configurada en `nodeOptions.disableCompressor` de `/play`.
    enableAudioPreset(queue);
    const presetActive = queue.options?.disableCompressor === false;
    // El preset DSP puede reiniciar el nodo a 100% al cambiar de pista; fijamos la base.
    // Aquí el dispatcher aún no existe, así que `setVolume` es un no-op silencioso:
    // registra el volumen deseado y se aplicará de verdad en `playerStart`.
    applyInitialVolume(queue, 70);
    logPlaybackEvent('queue_created', queue, { sessionId, presetActive }, client);

    traceQueueStateChanges(queue);
  });

  player.events.on('connection', (queue) => traceQueueStateChanges(queue));
  player.on('debug', (msg) => traceEvent('debug', 'player_debug', { msg }));
  player.events.on('debug', (queue, msg) => {
    if (msg.startsWith('[NW]')) return;
    traceEvent('debug', 'queue_debug', { guildId: queue.guild.id, msg });
  });
  player.events.on('playerFinish', (queue, track) => {
    traceEvent('audio', 'track_finished', {
      guildId: queue.guild.id,
      title: track.title,
      duration: track.duration,
    });
  });
  player.events.on('disconnect', (queue) => {
    traceEvent('voice', 'disconnected', { guildId: queue.guild.id });
  });
  player.events.on('willPlayTrack', (_queue, track) => {
    trackLoadTimer.start(track);
  });

  player.events.on('audioTrackAdd', (queue, track) => {
    logTracksQueued(queue, [track]);
    refreshQueuePanel(queue);
  });

  player.events.on('audioTracksAdd', (queue, tracks) => {
    logTracksQueued(queue, tracks);
    refreshQueuePanel(queue);
  });

  // Registrar eventos del player
  player.events.on('playerStart', (queue, track) => {
    const cargaMs = trackLoadTimer.consume(track) ?? 0;
    traceEvent('audio', 'track_started', {
      guildId: queue.guild.id,
      ...getTraceTrackDetails(track),
    });
    logPlaybackEvent('playback_started', queue, {
      ...getTrackDetails(track),
      cargaMs: Math.round(cargaMs),
    }, client);

    client.user?.setActivity(track.title, { type: ActivityType.Listening });

    // El dispatcher (y su `FiltersChain`) ya existe: reafirmamos el compresor PCM
    // tras crear el `AudioResource` y la ganancia real del stream, para que el
    // primer segundo suene igual que lo que muestra el panel.
    if (queue.dispatcher) {
      void enableAudioPreset(queue);
      const targetVolume = getDesiredVolume(queue, queue.node?.volume || 70);
      applyInitialVolume(queue, targetVolume);
      // Red de seguridad si el resource se adjunta después de `playerStart`.
      reapplyVolumeWhenPlaying(queue, targetVolume);
    }

    const channel = (queue.metadata as any)?.channel as any;
    if (!channel) return;

    setStartedAt(queue.guild.id, new Date());
    const embed = buildPanelEmbed(track, queue, getStartedAt(queue.guild.id));
    const rows = buildPanelRows(queue.node.isPaused(), queue.repeatMode, getPanelRowState(queue));
    void updatePanel(channel, embed, rows);
  });

  player.events.on('playerPause', (queue) => {
    const channel = (queue.metadata as any)?.channel as any;
    const current = queue.currentTrack;
    if (current) {
      client.user?.setActivity({
        name: 'Estado',
        type: ActivityType.Custom,
        state: `⏸️ ${current.title}`,
      });
    }
    if (!channel || !current) return;
    logPlaybackEvent('player_pause', queue, {}, client);
    const embed = buildPanelEmbed(current, queue, getStartedAt(queue.guild.id));
    const rows = buildPanelRows(true, queue.repeatMode, getPanelRowState(queue));
    void updatePanel(channel, embed, rows);
  });

  player.events.on('playerResume', (queue) => {
    const channel = (queue.metadata as any)?.channel as any;
    const current = queue.currentTrack;
    if (current) {
      client.user?.setActivity(current.title, { type: ActivityType.Listening });
    }
    if (!channel || !current) return;
    logPlaybackEvent('player_resume', queue, {}, client);
    const embed = buildPanelEmbed(current, queue, getStartedAt(queue.guild.id));
    const rows = buildPanelRows(false, queue.repeatMode, getPanelRowState(queue));
    void updatePanel(channel, embed, rows);
  });

  player.events.on('emptyQueue', (queue) => {
    client.user?.setActivity();
    logPlaybackEvent('queue_empty', queue, {}, client);
    const channel = (queue.metadata as any)?.channel as any;
    void updateEmptyPanel(channel);
  });

  player.events.on('queueDelete', (queue) => {
    client.user?.setActivity();
    logPlaybackEvent('queue_deleted', queue, {}, client);
    const channel = (queue.metadata as any)?.channel as any;
    void updateEmptyPanel(channel);
  });

  player.events.on('error', (queue, error) => {
    traceEvent('error', 'queue_error', {
      guildId: queue.guild.id,
      error: serializeError(error),
      ...getTraceTrackDetails(queue.currentTrack),
    });
    logPlaybackEvent('player_error', queue, { error }, client);
  });

  player.events.on('playerError', (queue, error, track) => {
    traceEvent('error', 'player_error', {
      guildId: queue.guild.id,
      error: serializeError(error),
      ...getTraceTrackDetails(track),
    });
    logPlaybackEvent('playback_error', queue, { error }, client);
  });
};
