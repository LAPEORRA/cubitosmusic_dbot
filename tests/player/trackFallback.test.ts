import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import type { Client, EmbedBuilder } from 'discord.js';
import type { GuildQueue, Player, Track } from 'discord-player';
import { ready } from '../../src/events/ready.js';
import { classifyPlayerError, tryFallbackYouTubeSearch } from '../../src/player/trackFallback.js';

function fakeTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: 'track-id',
    title: 'Pista caída',
    author: 'Artista',
    source: 'youtube',
    url: 'https://www.youtube.com/watch?v=failed',
    ...overrides,
  } as Track;
}

test('classifyPlayerError asigna el mensaje exacto a cada causa conocida', () => {
  const cases: ReadonlyArray<[raw: string, code: string, userMessage: string]> = [
    ['Private video', 'PRIVATE_VIDEO', 'El video es privado y no se puede reproducir'],
    ['Sign in to confirm your age', 'AGE_RESTRICTED', 'Bloqueado por restricción de edad (+18)'],
    ['age-restricted content', 'AGE_RESTRICTED', 'Bloqueado por restricción de edad (+18)'],
    ['Sign in to confirm you’re not a bot', 'ANTI_BOT', 'YouTube bloqueó temporalmente la petición (anti-bot)'],
    ['not a bot', 'ANTI_BOT', 'YouTube bloqueó temporalmente la petición (anti-bot)'],
    ['HTTP Error 429: Too Many Requests', 'ANTI_BOT', 'YouTube bloqueó temporalmente la petición (anti-bot)'],
    ['not made this video available in your country', 'GEO_RESTRICTED', 'No disponible en la región del servidor'],
    ['geo restriction', 'GEO_RESTRICTED', 'No disponible en la región del servidor'],
    ['Copyright claim', 'COPYRIGHT', 'Bloqueado por reclamo de copyright'],
    ['Video unavailable', 'UNAVAILABLE', 'Video borrado o no disponible en YouTube'],
    ['This video is not available', 'UNAVAILABLE', 'Video borrado o no disponible en YouTube'],
    ['Extractor failed for an unknown reason', 'UNKNOWN', 'No se pudo extraer el audio de este enlace'],
  ];

  for (const [raw, code, userMessage] of cases) {
    assert.deepEqual(classifyPlayerError(raw), { code, userMessage }, raw);
  }
});

test('rescata por título y artista, ignora la URL caída e inserta el reemplazo en índice 0', async () => {
  const failedTrack = fakeTrack({ url: 'https://www.youtube.com/watch?v=failed&t=20' });
  const duplicate = fakeTrack({ id: 'duplicate', url: 'https://youtu.be/failed?t=42' });
  const replacement = fakeTrack({ id: 'replacement', title: 'Pista recuperada', url: 'https://youtu.be/replacement' });
  const searches: string[] = [];
  const insertions: Array<{ track: Track; index: number }> = [];
  const player = {
    search: async (query: string) => {
      searches.push(query);
      return { tracks: [duplicate, replacement] };
    },
  } as unknown as Player;
  const queue = {
    insertTrack: (track: Track, index: number) => insertions.push({ track, index }),
  } as unknown as GuildQueue;

  const rescued = await tryFallbackYouTubeSearch(player, queue, failedTrack, new Error('yt-dlp failed'));

  assert.equal(searches[0], 'Pista caída Artista');
  assert.equal(rescued, replacement);
  assert.deepEqual(insertions, [{ track: replacement, index: 0 }]);
});

test('solo rescata errores yt-dlp fuera de YouTube y omite el autor Unknown', async () => {
  const failedTrack = fakeTrack({
    id: 'non-youtube',
    title: 'Tema por recuperar',
    author: 'Unknown',
    source: 'spotify',
    url: 'https://open.spotify.com/track/failed',
  });
  const replacement = fakeTrack({ id: 'replacement-unknown', url: 'https://youtube.com/watch?v=replacement-unknown' });
  const searches: string[] = [];
  const player = {
    search: async (query: string) => {
      searches.push(query);
      return { tracks: [replacement] };
    },
  } as unknown as Player;
  const queue = { insertTrack: () => {} } as unknown as GuildQueue;

  assert.equal(await tryFallbackYouTubeSearch(player, queue, failedTrack, new Error('extractor failed')), null);
  assert.equal(searches.length, 0);
  assert.equal(
    await tryFallbackYouTubeSearch(player, queue, failedTrack, new Error('yt-dlp failed')),
    replacement,
  );
  assert.deepEqual(searches, ['Tema por recuperar']);
});

test('evita reintentos de una pista rescatada y de la misma URL fallida', async () => {
  const failedTrack = fakeTrack({ url: 'https://youtube.com/watch?v=loop-guard' });
  const replacement = fakeTrack({ id: 'rescued-track', url: 'https://youtube.com/watch?v=replacement' });
  let searchCount = 0;
  const player = {
    search: async () => {
      searchCount += 1;
      return { tracks: [replacement] };
    },
  } as unknown as Player;
  const queue = { insertTrack: () => {} } as unknown as GuildQueue;

  assert.equal(await tryFallbackYouTubeSearch(player, queue, failedTrack, new Error('yt-dlp failed')), replacement);
  assert.equal(await tryFallbackYouTubeSearch(player, queue, failedTrack, new Error('yt-dlp failed')), null);
  assert.equal(await tryFallbackYouTubeSearch(player, queue, replacement, new Error('yt-dlp failed')), null);
  assert.equal(searchCount, 1);
});

test('si la búsqueda de rescate no encuentra reemplazo, avisa en el canal sin alterar la cola', async () => {
  const originalLog = console.log;
  const output: string[] = [];
  const sent: Array<{ embeds: EmbedBuilder[] }> = [];
  let resolveWarning!: () => void;
  const warningSent = new Promise<void>((resolve) => {
    resolveWarning = resolve;
  });
  const message = { delete: async () => {} };
  const events = new EventEmitter();
  const player = Object.assign(new EventEmitter(), {
    events,
    extractors: { store: { size: 0 } },
    search: async () => ({ tracks: [] }),
  }) as unknown as Player;
  const channel = {
    name: 'musica',
    async send(payload: { embeds: EmbedBuilder[] }) {
      sent.push(payload);
      resolveWarning();
      return message;
    },
  };
  const failedTrack = fakeTrack();
  const queue = {
    guild: { id: 'track-fallback-test' },
    metadata: { channel },
    currentTrack: failedTrack,
    channel: { name: 'musica' },
    tracks: { size: 3 },
    history: { tracks: { size: 0 } },
  } as unknown as GuildQueue;
  const client = {
    guilds: { fetch: async () => ({ name: 'Servidor de prueba' }) },
    user: { tag: 'CubitoMusic#0000' },
    ws: { ping: 0 },
  } as unknown as Client;

  console.log = (...args: unknown[]) => output.push(args.map(String).join(' '));
  try {
    await ready(client, player, 'track-fallback-test');
    events.emit('playerError', queue, new Error('Private video'), failedTrack);
    await warningSent;
  } finally {
    console.log = originalLog;
  }

  assert.equal(sent.length, 1);
  assert.equal(sent[0].embeds[0].data.color, 0xfee75c);
  assert.match(sent[0].embeds[0].data.description ?? '', /Pista caída/);
  assert.match(sent[0].embeds[0].data.description ?? '', /El video es privado y no se puede reproducir/);
  assert.equal(queue.tracks.size, 3, 'el fallo del rescate no debe vaciar ni modificar la cola');
  assert.match(output.join('\n'), /\[ERROR\].*Track: El video es privado y no se puede reproduci/);
});
