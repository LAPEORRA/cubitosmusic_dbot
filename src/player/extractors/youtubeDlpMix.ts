import { YouTubeDlpExtractor } from 'discord-player-youtubedlp';
import type { ExtractorInfo, ExtractorSearchContext } from 'discord-player';

function isMixList(input: string): boolean {
  try {
    const listId = new URL(input).searchParams.get('list');
    if (!listId) return false;
    return (
      listId.startsWith('RD') ||
      listId.startsWith('RDMM') ||
      listId.startsWith('RDEM') ||
      listId.startsWith('RDAMVM')
    );
  } catch {
    return false;
  }
}

function normalizeMixUrl(input: string): string {
  try {
    const u = new URL(input);
    const listId = u.searchParams.get('list');
    const videoId = u.searchParams.get('v');
    if (!listId) return input;
    const url = videoId
      ? `https://www.youtube.com/watch?v=${videoId}&list=${encodeURIComponent(listId)}`
      : `https://www.youtube.com/playlist?list=${encodeURIComponent(listId)}`;
    return `${url}&start_radio=1`;
  } catch {
    return input;
  }
}

export class YouTubeDlpMixExtractor extends YouTubeDlpExtractor {
  override async handle(query: string, context: ExtractorSearchContext): Promise<ExtractorInfo> {
    if (isMixList(query)) {
      const result = await (this as unknown as {
        resolvePlaylist(query: string, context: ExtractorSearchContext): Promise<ExtractorInfo>;
      }).resolvePlaylist(normalizeMixUrl(query), context);
      if (result?.tracks?.length) return result;
    }
    return super.handle(query, context);
  }
}