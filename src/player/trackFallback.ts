import type { GuildQueue, Player, Track } from 'discord-player';
import { normalizeUrl } from './url.js';

const FALLBACK_SEARCH_TIMEOUT_MS = 8_000;
const MAX_ATTEMPT_KEYS = 256;
const rescuedTracks = new WeakSet<Track>();
const attemptedTracks = new WeakSet<Track>();
const attemptedTrackKeys = new Map<string, true>();

const ERROR_MESSAGES = {
  PRIVATE_VIDEO: 'El video es privado y no se puede reproducir',
  AGE_RESTRICTED: 'Bloqueado por restricción de edad (+18)',
  ANTI_BOT: 'YouTube bloqueó temporalmente la petición (anti-bot)',
  GEO_RESTRICTED: 'No disponible en la región del servidor',
  COPYRIGHT: 'Bloqueado por reclamo de copyright',
  UNAVAILABLE: 'Video borrado o no disponible en YouTube',
  UNKNOWN: 'No se pudo extraer el audio de este enlace',
} as const;

export function classifyPlayerError(rawMessage: string): { code: string; userMessage: string } {
  if (/private video/i.test(rawMessage)) {
    return { code: 'PRIVATE_VIDEO', userMessage: ERROR_MESSAGES.PRIVATE_VIDEO };
  }
  if (/sign in to confirm your age|age-restricted/i.test(rawMessage)) {
    return { code: 'AGE_RESTRICTED', userMessage: ERROR_MESSAGES.AGE_RESTRICTED };
  }
  if (/sign in to confirm.{0,30}not a bot|not a bot|\b429\b/i.test(rawMessage)) {
    return { code: 'ANTI_BOT', userMessage: ERROR_MESSAGES.ANTI_BOT };
  }
  if (/not made (?:this video )?available in your country|not available in your country|\bgeo/i.test(rawMessage)) {
    return { code: 'GEO_RESTRICTED', userMessage: ERROR_MESSAGES.GEO_RESTRICTED };
  }
  if (/copyright/i.test(rawMessage)) {
    return { code: 'COPYRIGHT', userMessage: ERROR_MESSAGES.COPYRIGHT };
  }
  if (/video unavailable|this video is not available/i.test(rawMessage)) {
    return { code: 'UNAVAILABLE', userMessage: ERROR_MESSAGES.UNAVAILABLE };
  }
  return { code: 'UNKNOWN', userMessage: ERROR_MESSAGES.UNKNOWN };
}

function getErrorText(error: unknown): string {
  if (error instanceof Error) return `${error.name} ${error.message}`;
  if (typeof error === 'object' && error !== null) {
    const record = error as { name?: unknown; message?: unknown; code?: unknown };
    return [record.name, record.message, record.code]
      .filter((value): value is string | number => typeof value === 'string' || typeof value === 'number')
      .join(' ');
  }
  return String(error);
}

function isYouTubeUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com');
  } catch {
    return false;
  }
}

function getAttemptKey(track: Track): string {
  const url = typeof track.url === 'string' ? normalizeUrl(track.url).trim() : '';
  if (url) return `url:${url.slice(0, 512)}`;

  const title = track.title.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
  const author = track.author?.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim() ?? '';
  return `track:${`${title} ${author}`.slice(0, 512)}`;
}

function rememberAttempt(key: string): boolean {
  if (attemptedTrackKeys.has(key)) return false;
  attemptedTrackKeys.set(key, true);
  if (attemptedTrackKeys.size > MAX_ATTEMPT_KEYS) {
    const oldestKey = attemptedTrackKeys.keys().next().value;
    if (oldestKey !== undefined) attemptedTrackKeys.delete(oldestKey);
  }
  return true;
}

export async function tryFallbackYouTubeSearch(
  player: Player,
  queue: GuildQueue,
  failedTrack: Track | null | undefined,
  error: unknown,
): Promise<Track | null> {
  if (!failedTrack?.title || rescuedTracks.has(failedTrack) || attemptedTracks.has(failedTrack)) return null;

  const errorText = getErrorText(error);
  const isYtDlpError = /yt[- ]?dlp|youtubedlp|com\.dfxphoenix\.youtubedlp/i.test(errorText);
  if (failedTrack.source !== 'youtube' && !isYouTubeUrl(failedTrack.url) && !isYtDlpError) return null;
  attemptedTracks.add(failedTrack);
  if (!rememberAttempt(getAttemptKey(failedTrack))) return null;

  const author = failedTrack.author?.trim();
  const query = [failedTrack.title.trim(), author && author.toLowerCase() !== 'unknown' ? author : '']
    .filter(Boolean)
    .join(' ');
  if (!query) return null;

  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      player.search(query),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('Búsqueda de rescate agotó el tiempo')), FALLBACK_SEARCH_TIMEOUT_MS);
      }),
    ]);
    const failedUrl = normalizeUrl(failedTrack.url);
    const replacement = result.tracks.find((track) => normalizeUrl(track.url) !== failedUrl);
    if (!replacement) return null;

    rescuedTracks.add(replacement);
    queue.insertTrack(replacement, 0);
    return replacement;
  } catch {
    return null;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
