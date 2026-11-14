import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { Client } from 'discord.js';
import { ActivityType } from 'discord.js';
import type { GuildQueue, Player, Track } from 'discord-player';
import { logTracksQueued, ready } from '../../src/events/ready.js';

const stripAnsi = (text: string) => text.replace(/\u001b\[[0-9;]*m/g, '');

function captureLogs(fn: () => void): string[] {
  const originalLog = console.log;
  const lines: string[] = [];
  console.log = ((...args: unknown[]) => {
    lines.push(args.map((a) => String(a)).join(' '));
  }) as typeof console.log;
  try {
    fn();
  } finally {
    console.log = originalLog;
  }
  return lines;
}

function fakeQueue(size: number): GuildQueue {
  return {
    tracks: { size },
    channel: { name: 'musica' },
  } as unknown as GuildQueue;
}

function fakeTrack(title: string, playlist: { title: string; source?: string } | null = null): Track {
  return {
    id: title,
    title,
    duration: '3:00',
    playlist,
  } as unknown as Track;
}

test('tracks_queued muestra el título del álbum cuando la playlist existe', () => {
  const tracks = [
    fakeTrack('One More Time', { title: 'Discovery', source: 'youtube' }),
    fakeTrack('Aerodynamic'),
    fakeTrack('Digital Love'),
  ];

  const lines = captureLogs(() => logTracksQueued(fakeQueue(3), tracks));
  const plain = stripAnsi(lines.join('\n'));

  assert.match(plain, /Playlist: Discovery \(\+3 pistas\)/);
});

test('tracks_queued usa "Playlist añadida" cuando no hay metadatos de playlist', () => {
  const tracks = [
    fakeTrack('Track 1'),
    fakeTrack('Track 2'),
    fakeTrack('Track 3'),
    fakeTrack('Track 4'),
  ];

  const lines = captureLogs(() => logTracksQueued(fakeQueue(4), tracks));
  const plain = stripAnsi(lines.join('\n'));

  assert.match(plain, /Playlist añadida \(\+4 pistas\)/);
  assert.doesNotMatch(plain, /Cola actualizada/);
});

test('tracks_queued con una sola pista mantiene el detalle de la canción', () => {
  const lines = captureLogs(() => logTracksQueued(fakeQueue(1), [fakeTrack('One More Time')]));
  const plain = stripAnsi(lines.join('\n'));

  assert.match(plain, /One More Time • 3:00/);
});

test('deduplica errores de TUI por 2 segundos y filtra debug [NW] sin perder trazas', async () => {
  const originalCwd = process.cwd();
  const originalLog = console.log;
  const originalDateNow = Date.now;
  const originalLiveTrace = process.env.LIVE_TRACE;
  const originalLogToFile = process.env.LOG_TO_FILE;
  const directory = mkdtempSync(join(tmpdir(), 'cubitosmusic-ready-'));
  const lines: string[] = [];
  let now = 1_000;

  const events = new EventEmitter();
  events.setMaxListeners(0);
  const player = Object.assign(new EventEmitter(), {
    events,
    extractors: { store: { size: 0 } },
  }) as unknown as Player;
  const client = {
    guilds: { fetch: async () => ({ name: 'Servidor de prueba' }) },
    user: { tag: 'CubitoMusic#0000' },
    ws: { ping: 42 },
  } as unknown as Client;
  const queue = {
    guild: { id: 'guild-error-dedup-test' },
    currentTrack: { title: 'Track de prueba' },
    channel: { name: 'musica' },
    tracks: { size: 0 },
    history: { tracks: { size: 0 } },
  } as unknown as GuildQueue;

  try {
    process.chdir(directory);
    process.env.LIVE_TRACE = 'true';
    process.env.LOG_TO_FILE = 'false';
    Date.now = () => now;
    console.log = (...args: unknown[]) => lines.push(args.map(String).join(' '));

    await ready(client, player, 'guild-error-dedup-test');
    lines.length = 0;

    const firstError = new Error('HTTP Error 403');
    events.emit('error', queue, firstError);
    now += 1;
    events.emit('error', queue, firstError);
    now += 1;
    events.emit('error', queue, new Error('fallo distinto'));
    now += 2_000;
    events.emit('error', queue, firstError);

    events.emit('debug', queue, '[NW] token=must-not-be-written');
    events.emit('debug', queue, 'diagnóstico seguro');

    const errorRows = lines.map(stripAnsi).filter((line) => line.includes('[ERROR]'));
    assert.equal(errorRows.length, 3);
    assert.match(errorRows[0], /HTTP Error 403/);
    assert.match(errorRows[1], /fallo distinto/);
    assert.match(errorRows[2], /HTTP Error 403/);

    const tracePath = join(directory, 'logs', 'live-trace.jsonl');
    assert.equal(existsSync(tracePath), true);
    const traces = readFileSync(tracePath, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as { category: string; event: string; msg?: string });
    assert.equal(traces.filter((trace) => trace.category === 'error').length, 4);
    assert.equal(traces.some((trace) => trace.msg?.includes('[NW]')), false);
    assert.equal(traces.some((trace) => trace.msg === 'diagnóstico seguro'), true);
  } finally {
    console.log = originalLog;
    Date.now = originalDateNow;
    if (originalLiveTrace === undefined) delete process.env.LIVE_TRACE;
    else process.env.LIVE_TRACE = originalLiveTrace;
    if (originalLogToFile === undefined) delete process.env.LOG_TO_FILE;
    else process.env.LOG_TO_FILE = originalLogToFile;
    process.chdir(originalCwd);
    rmSync(directory, { recursive: true, force: true });
  }
});

test('actualiza la presencia al reproducir, pausar y reanudar, y la limpia al cerrar la cola', async () => {
  const originalLog = console.log;
  const activityCalls: unknown[][] = [];

  const events = new EventEmitter();
  events.setMaxListeners(0);
  const player = Object.assign(new EventEmitter(), {
    events,
    extractors: { store: { size: 0 } },
  }) as unknown as Player;

  const client = {
    guilds: { fetch: async () => ({ name: 'Servidor de prueba' }) },
    user: {
      tag: 'CubitoMusic#0000',
      setActivity: (...args: unknown[]) => {
        activityCalls.push(args);
      },
    },
    ws: { ping: 42 },
  } as unknown as Client;

  const guildId = `guild-presence-${Date.now()}`;
  const track = {
    id: 'track-1',
    title: 'One More Time',
    duration: '5:20',
    source: 'youtube',
    author: 'Daft Punk',
    url: 'https://example.com/track',
    thumbnail: 'https://example.com/thumb.jpg',
    requestedBy: { username: 'Santiago' },
  } as unknown as Track;

  const message = {
    editable: true,
    deletable: false,
    components: [],
    async edit() {
      return message;
    },
  };
  const queue = {
    guild: { id: guildId },
    metadata: {
      channel: {
        guildId,
        name: 'musica',
        send: async () => message,
      },
    },
    currentTrack: track,
    tracks: { size: 1, data: [track] },
    history: { isEmpty: () => false, tracks: { size: 1 } },
    repeatMode: 0,
    node: { isPaused: () => false, volume: 70, createProgressBar: () => '0:00 / 5:20' },
    channel: { name: 'musica' },
  } as unknown as GuildQueue;

  console.log = () => {};
  try {
    await ready(client, player, guildId);
    events.emit('playerStart', queue, track);
    events.emit('playerPause', queue);
    events.emit('playerResume', queue);
    events.emit('emptyQueue', queue);
    events.emit('queueDelete', queue);
    // Deja terminar los `updatePanel` lanzados sin await antes de restaurar la consola.
    await new Promise((resolve) => setImmediate(resolve));
  } finally {
    console.log = originalLog;
  }

  assert.equal(activityCalls.length, 5);
  assert.deepEqual(activityCalls[0], ['One More Time', { type: ActivityType.Listening }]);
  assert.deepEqual(activityCalls[1], ['⏸️ One More Time', { type: ActivityType.Custom }]);
  assert.deepEqual(activityCalls[2], ['One More Time', { type: ActivityType.Listening }]);
  assert.deepEqual(activityCalls[3], []);
  assert.deepEqual(activityCalls[4], []);
});
