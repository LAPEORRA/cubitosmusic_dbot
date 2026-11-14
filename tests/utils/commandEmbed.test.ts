import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildCommandEmbed } from '../../src/utils/commandEmbed.js';

test('buildCommandEmbed crea un mini-embed con color de marca y campos opcionales', () => {
  const embed = buildCommandEmbed({
    author: 'CubitoMusic',
    title: 'Canción',
    description: '3:45 • Cola: 2 canciones',
    footer: 'CubitoMusic',
  });

  assert.equal(embed.data.color, 0x5865f2);
  assert.equal(embed.data.author?.name, 'CubitoMusic');
  assert.equal(embed.data.title, 'Canción');
  assert.equal(embed.data.description, '3:45 • Cola: 2 canciones');
  assert.equal(embed.data.footer?.text, 'CubitoMusic');
  assert.equal(embed.data.url, undefined);
  assert.equal(embed.data.thumbnail, undefined);
});

test('buildCommandEmbed aplica url y miniatura solo si son http(s)', () => {
  const valid = buildCommandEmbed({
    description: 'ok',
    url: 'https://example.com/track',
    thumbnail: 'https://example.com/thumb.jpg',
  });
  assert.equal(valid.data.url, 'https://example.com/track');
  assert.equal(valid.data.thumbnail?.url, 'https://example.com/thumb.jpg');

  const invalid = buildCommandEmbed({
    description: 'ok',
    url: 'javascript:alert(1)',
    thumbnail: 'no-es-url',
  });
  assert.equal(invalid.data.url, undefined);
  assert.equal(invalid.data.thumbnail, undefined);
});
