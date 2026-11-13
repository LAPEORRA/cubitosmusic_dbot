import { randomUUID } from 'node:crypto';
import { Client } from 'discord.js';
import type { GuildQueue, Player, Track } from 'discord-player';
import { buildPanelEmbed, buildPanelRows, updatePanel, setStartedAt, getStartedAt, updateEmptyPanel } from '../player/panel/panel.js';
import { enableAudioPreset } from '../player/audioPreset.js';
import {
  getSystemMetrics,
  logRow,
  printStartupBanner,
  serializeError,
  traceEvent,
  type LogColor,
} from '../utils/logger.js';

const playbackSessionIds = new WeakMap<GuildQueue, string>();
const queuedAtByTrack = new WeakMap<Track, number>();
const tracedDispatchers = new WeakSet<object>();

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

export function logTracksQueued(queue: GuildQueue, tracks: Track[]) {
  const preview = tracks.slice(0, 5).map((track) => track.title);
  for (const track of tracks) queuedAtByTrack.set(track, performance.now());

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
      const queuedForMs = typeof details.queuedForMs === 'number' ? details.queuedForMs : 0;
      const sequence = queue.history.tracks.size + 1;
      metricsText = `Carga: ${(queuedForMs / 1000).toFixed(1)}s • #${sequence} • ${getSystemMetrics(client)}`;
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
      const errorText = typeof details.error === 'object' && details.error !== null
        ? getErrorDetails(details.error).errorMessage
        : String(details.error ?? details.errorMessage ?? 'Error de reproducción');
      const failedTrack = queue.currentTrack;
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

  player.events.on('queueCreate', (queue) => {
    const sessionId = getPlaybackSessionId(queue);
    const presetActive = enableAudioPreset(queue);
    // El preset DSP puede reiniciar el nodo a 100% al cambiar de pista; fijamos la base.
    if (typeof queue.node?.setVolume === 'function') queue.node.setVolume(70);
    logPlaybackEvent('queue_created', queue, { sessionId, presetActive }, client);

    traceQueueStateChanges(queue);
  });

  player.events.on('connection', (queue) => traceQueueStateChanges(queue));
  player.on('debug', (msg) => traceEvent('debug', 'player_debug', { msg }));
  player.events.on('debug', (queue, msg) => {
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

  player.events.on('audioTrackAdd', (queue, track) => logTracksQueued(queue, [track]));

  player.events.on('audioTracksAdd', (queue, tracks) => logTracksQueued(queue, tracks));

  // Registrar eventos del player
  player.events.on('playerStart', (queue, track) => {
    const queuedAt = queuedAtByTrack.get(track);
    queuedAtByTrack.delete(track);
    traceEvent('audio', 'track_started', {
      guildId: queue.guild.id,
      ...getTraceTrackDetails(track),
    });
    logPlaybackEvent('playback_started', queue, {
      ...getTrackDetails(track),
      queuedForMs: queuedAt === undefined ? 0 : Math.round(performance.now() - queuedAt),
    }, client);

    const channel = (queue.metadata as any)?.channel as any;
    if (!channel) return;

    setStartedAt(queue.guild.id, new Date());
    const embed = buildPanelEmbed(track, queue, getStartedAt(queue.guild.id));
    const rows = buildPanelRows(queue.node.isPaused(), queue.repeatMode);
    void updatePanel(channel, embed, rows);
  });

  player.events.on('playerPause', (queue) => {
    const channel = (queue.metadata as any)?.channel as any;
    const current = queue.currentTrack;
    if (!channel || !current) return;
    logPlaybackEvent('player_pause', queue, {}, client);
    const embed = buildPanelEmbed(current, queue, getStartedAt(queue.guild.id));
    const rows = buildPanelRows(true, queue.repeatMode);
    void updatePanel(channel, embed, rows);
  });

  player.events.on('playerResume', (queue) => {
    const channel = (queue.metadata as any)?.channel as any;
    const current = queue.currentTrack;
    if (!channel || !current) return;
    logPlaybackEvent('player_resume', queue, {}, client);
    const embed = buildPanelEmbed(current, queue, getStartedAt(queue.guild.id));
    const rows = buildPanelRows(false, queue.repeatMode);
    void updatePanel(channel, embed, rows);
  });

  player.events.on('emptyQueue', (queue) => {
    logPlaybackEvent('queue_empty', queue, {}, client);
    const channel = (queue.metadata as any)?.channel as any;
    void updateEmptyPanel(channel);
  });

  player.events.on('queueDelete', (queue) => {
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
