import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConfigError, loadConfig } from '../src/config.js';

const baseEnv = {
  DISCORD_TOKEN: 'token',
  CLIENT_ID: 'client-id',
  GUILD_ID: 'guild-id',
};

function assertIncompleteSpotify(env: NodeJS.ProcessEnv) {
  assert.throws(
    () => loadConfig(env),
    (error: unknown) => {
      assert.ok(error instanceof ConfigError);
      assert.match(
        error.message,
        /Configuración de Spotify incompleta: debes definir SPOTIFY_CLIENT_ID y SPOTIFY_CLIENT_SECRET juntos\./,
      );
      return true;
    },
  );
}

test('loadConfig lanza ConfigError si solo se define SPOTIFY_CLIENT_ID', () => {
  assertIncompleteSpotify({ ...baseEnv, SPOTIFY_CLIENT_ID: 'solo-id' });
});

test('loadConfig lanza ConfigError si solo se define SPOTIFY_CLIENT_SECRET', () => {
  assertIncompleteSpotify({ ...baseEnv, SPOTIFY_CLIENT_SECRET: 'solo-secret' });
});

test('loadConfig trata credenciales en blanco como ausentes y detecta el par incompleto', () => {
  assertIncompleteSpotify({ ...baseEnv, SPOTIFY_CLIENT_ID: '   ', SPOTIFY_CLIENT_SECRET: 'secret' });
});

test('loadConfig acepta Spotify completo', () => {
  const config = loadConfig({
    ...baseEnv,
    SPOTIFY_CLIENT_ID: 'spotify-id',
    SPOTIFY_CLIENT_SECRET: 'spotify-secret',
  });

  assert.deepEqual(config.spotify, {
    clientId: 'spotify-id',
    clientSecret: 'spotify-secret',
  });
});

test('loadConfig deja Spotify en null si no hay credenciales', () => {
  const config = loadConfig(baseEnv);
  assert.equal(config.spotify, null);
});
