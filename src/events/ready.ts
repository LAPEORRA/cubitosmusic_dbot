import { randomUUID } from 'node:crypto';
import { Client } from 'discord.js';
import type { GuildQueue, Player, Track } from 'discord-player';
import { buildPanelEmbed, buildPanelRows, updatePanel, setStartedAt, getStartedAt, updateEmptyPanel } from '../player/panel/panel.js';
import { enableAudioPreset } from '../player/audioPreset.js';

const playbackSessionIds = new WeakMap<GuildQueue, string>();
const queuedAtByTrack = new WeakMap<Track, number>();

function getPlaybackSessionId(queue: GuildQueue): string {
  let sessionId = playbackSessionIds.get(queue);
  if (!sessionId) {
    sessionId = randomUUID();
    playbackSessionIds.set(queue, sessionId);
  }
  return sessionId;
}

function logPlaybackEvent(
  event: string,
  queue: GuildQueue,
  details: Record<string, unknown> = {},
) {
  const output = event.endsWith('_error') ? console.error : console.log;
  output(JSON.stringify({
    timestamp: new Date().toISOString(),
    event,
    playbackSessionId: getPlaybackSessionId(queue),
    guildId: queue.guild.id,
    channel: queue.channel ? { id: queue.channel.id, name: queue.channel.name } : null,
    ...details,
  }));
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

function getErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return { errorName: error.name, errorMessage: error.message };
  }
  return { errorMessage: String(error) };
}

function logTracksQueued(queue: GuildQueue, tracks: Track[]) {
  const preview = tracks.slice(0, 5).map((track) => track.title);
  for (const track of tracks) queuedAtByTrack.set(track, performance.now());

  logPlaybackEvent('tracks_queued', queue, {
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

export const ready = async (client: Client, player: Player, guildId: string) => {
  console.log(`✅ Bot listo como: ${client.user?.tag}`);

  player.events.on('queueCreate', (queue) => {
    getPlaybackSessionId(queue);
    logPlaybackEvent('queue_created', queue);
    enableAudioPreset(queue);
  });

  player.events.on('audioTrackAdd', (queue, track) => logTracksQueued(queue, [track]));
  player.events.on('audioTracksAdd', (queue, tracks) => logTracksQueued(queue, tracks));

  // Registrar eventos del player
  player.events.on('playerStart', (queue, track) => {
    const queuedAt = queuedAtByTrack.get(track);
    queuedAtByTrack.delete(track);
    logPlaybackEvent('playback_started', queue, {
      ...getTrackDetails(track),
      playbackSequence: queue.history.tracks.size + 1,
      queueSize: queue.tracks.size,
      queuedForMs: queuedAt === undefined ? null : Math.round(performance.now() - queuedAt),
    });

    const channel = (queue.metadata as any)?.channel as any;
    if (!channel) return;

    setStartedAt(queue.guild.id, new Date());
    const embed = buildPanelEmbed(track, queue, getStartedAt(queue.guild.id), (queue.metadata as any)?.requestedBy?.username);
    const rows = buildPanelRows(queue.node.isPaused());
    void updatePanel(channel, embed, rows);
  });

  player.events.on('playerPause', (queue) => {
    const channel = (queue.metadata as any)?.channel as any;
    const current = queue.currentTrack;
    if (!channel || !current) return;
    const embed = buildPanelEmbed(current, queue, getStartedAt(queue.guild.id), (queue.metadata as any)?.requestedBy?.username);
    const rows = buildPanelRows(true);
    void updatePanel(channel, embed, rows);
  });

  player.events.on('playerResume', (queue) => {
    const channel = (queue.metadata as any)?.channel as any;
    const current = queue.currentTrack;
    if (!channel || !current) return;
    const embed = buildPanelEmbed(current, queue, getStartedAt(queue.guild.id), (queue.metadata as any)?.requestedBy?.username);
    const rows = buildPanelRows(false);
    void updatePanel(channel, embed, rows);
  });

  player.events.on('emptyQueue', (queue) => {
    logPlaybackEvent('queue_empty', queue, { queueSize: queue.tracks.size });
    const channel = (queue.metadata as any)?.channel as any;
    void updateEmptyPanel(channel);
  });

  player.events.on('queueDelete', (queue) => {
    logPlaybackEvent('queue_deleted', queue, { queueSize: queue.tracks.size });
  });

  player.events.on('error', (queue, error) => {
    logPlaybackEvent('player_error', queue, {
      ...getErrorDetails(error),
      currentTrack: queue.currentTrack ? getTrackDetails(queue.currentTrack) : null,
      queueSize: queue.tracks.size,
    });
  });

  player.events.on('playerError', (queue, error) => {
    logPlaybackEvent('playback_error', queue, {
      ...getErrorDetails(error),
      currentTrack: queue.currentTrack ? getTrackDetails(queue.currentTrack) : null,
      queueSize: queue.tracks.size,
    });
  });

  try {
    const guild = await client.guilds.fetch(guildId);
    console.log(`📝 Bot activo en guild: ${guild.name}`);
  } catch (error) {
    console.error('❌ Error:', error);
  }
};