import type { Track } from 'discord-player';

type QueueSummaryTrack = Pick<Track, 'title' | 'author'>;

export function buildQueueReply(
  current: QueueSummaryTrack | null,
  tracks: readonly QueueSummaryTrack[],
): { content: string; allowedMentions: { parse: never[] } } {
  return {
    content: !current && tracks.length === 0
      ? '📭 No hay canciones en la cola.'
      : buildQueueSummary(current, tracks),
    allowedMentions: { parse: [] },
  };
}

export function buildQueueSummary(
  current: QueueSummaryTrack | null,
  tracks: readonly QueueSummaryTrack[],
): string {
  const visibleTracks = tracks
    .slice(0, 10)
    .map((track, index) => `${index + 1}. **${track.title}** — ${track.author}`)
    .join('\n');

  const parts: string[] = [];
  if (current) parts.push(`🎵 **Ahora:** ${current.title}`);
  parts.push(`📋 **Cola (${tracks.length}):** ${visibleTracks || 'vacía'}`);
  if (tracks.length > 10) parts.push(`... y ${tracks.length - 10} más`);
  return parts.join('\n');
}
