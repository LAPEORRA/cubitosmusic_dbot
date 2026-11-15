import type { Track } from 'discord-player';
import { buildCommandEmbed } from '../utils/commandEmbed.js';

type QueueSummaryTrack = Pick<Track, 'title' | 'author'> &
  Partial<Pick<Track, 'duration' | 'thumbnail'>>;

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
    .map((track, index) => {
      const duration = track.duration ? ` \`${track.duration}\`` : '';
      return `${index + 1}. **${track.title}** — ${track.author}${duration}`;
    })
    .join('\n');

  const parts: string[] = [];
  if (current) parts.push(`🎵 **Ahora:** ${current.title}`);
  parts.push(
    tracks.length > 0
      ? `📋 **Cola (${tracks.length}):**\n${visibleTracks}`
      : '📋 **Cola (0):** vacía',
  );
  if (tracks.length > 10) parts.push(`... y ${tracks.length - 10} más`);
  return parts.join('\n');
}

export function buildQueueEmbed(
  current: QueueSummaryTrack | null,
  tracks: readonly QueueSummaryTrack[],
) {
  const reply = buildQueueReply(current, tracks);
  const waitingLabel = `${tracks.length} ${tracks.length === 1 ? 'canción' : 'canciones'} en espera`;

  return buildCommandEmbed({
    author: 'CubitoMusic',
    title: '📋 Cola de reproducción',
    description: reply.content,
    thumbnail: current?.thumbnail,
    footer: tracks.length > 0 ? waitingLabel : 'CubitoMusic',
  });
}
