import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeUrl } from '../../src/player/url.js';

const cases: ReadonlyArray<[input: string, expected: string]> = [
  // YouTube Music -> YouTube regular
  [
    'https://music.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  ],
  // YouTube Music conserva el list= (playlist/mix)
  [
    'https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=RDAMVMdQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDAMVMdQw4w9WgXcQ',
  ],
  // Playlist de YouTube Music -> playlist limpia
  [
    'https://music.youtube.com/playlist?list=PL123&si=abc',
    'https://www.youtube.com/playlist?list=PL123',
  ],
  // Playlist de YouTube -> playlist limpia
  [
    'https://www.youtube.com/playlist?list=PL456&si=def',
    'https://www.youtube.com/playlist?list=PL456',
  ],
  // Enlace corto -> watch?v=
  [
    'https://youtu.be/dQw4w9WgXcQ?t=42',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  ],
  // Vídeo con parámetros extra -> URL limpia
  [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  ],
  // Vídeo dentro de playlist -> se deja intacto
  [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL789',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL789',
  ],
  // SoundCloud sin query
  [
    'https://soundcloud.com/artist/track?si=xyz',
    'https://soundcloud.com/artist/track',
  ],
  // Spotify se deja intacto
  [
    'https://open.spotify.com/track/abc123',
    'https://open.spotify.com/track/abc123',
  ],
  // Búsqueda de texto se deja intacta
  ['daft punk one more time', 'daft punk one more time'],
];

test('normalizeUrl aplica las mismas reglas que la versión original de play.ts', () => {
  for (const [input, expected] of cases) {
    assert.equal(normalizeUrl(input), expected, `normalizeUrl(${input})`);
  }
});
