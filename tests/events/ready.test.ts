import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GuildQueue, Track } from 'discord-player';
import { logTracksQueued } from '../../src/events/ready.js';

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
