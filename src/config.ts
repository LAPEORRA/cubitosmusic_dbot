import 'dotenv/config';

/** Configuración tipada del bot, resuelta una sola vez al arrancar. */
export interface BotConfig {
  discordToken: string;
  clientId: string;
  guildId: string;
  spotify: {
    clientId: string;
    clientSecret: string;
  } | null;
  /** Ruta a un cookies.txt en formato Netscape para yt-dlp (null = sin cookies). */
  youtubeCookies: string | null;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

function read(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const value = env[key]?.trim();
  return value ? value : undefined;
}

/**
 * Valida el entorno y devuelve la configuración del bot.
 *
 * Obligatorias: `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`.
 * Opcionales: `SPOTIFY_CLIENT_ID` + `SPOTIFY_CLIENT_SECRET` (deben venir juntas),
 * y `YOUTUBE_COOKIES` (ruta a un cookies.txt de YouTube para yt-dlp).
 *
 * @throws {ConfigError} si falta alguna variable obligatoria o si Spotify está incompleto.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): BotConfig {
  const discordToken = read(env, 'DISCORD_TOKEN');
  const clientId = read(env, 'CLIENT_ID');
  const guildId = read(env, 'GUILD_ID');

  const missing = [
    !discordToken && 'DISCORD_TOKEN',
    !clientId && 'CLIENT_ID',
    !guildId && 'GUILD_ID',
  ].filter(Boolean) as string[];

  if (missing.length > 0) {
    throw new ConfigError(`Faltan variables de entorno en .env: ${missing.join(', ')}`);
  }

  const spotifyClientId = read(env, 'SPOTIFY_CLIENT_ID');
  const spotifyClientSecret = read(env, 'SPOTIFY_CLIENT_SECRET');

  if (Boolean(spotifyClientId) !== Boolean(spotifyClientSecret)) {
    throw new ConfigError(
      'Configuración de Spotify incompleta: debes definir SPOTIFY_CLIENT_ID y SPOTIFY_CLIENT_SECRET juntos.',
    );
  }

  const spotify =
    spotifyClientId && spotifyClientSecret
      ? { clientId: spotifyClientId, clientSecret: spotifyClientSecret }
      : null;

  return {
    discordToken: discordToken!,
    clientId: clientId!,
    guildId: guildId!,
    spotify,
    youtubeCookies: read(env, 'YOUTUBE_COOKIES') ?? null,
  };
}

/** Config global del proceso. Si el entorno es inválido imprime el motivo y aborta. */
export function loadConfigOrExit(env: NodeJS.ProcessEnv = process.env): BotConfig {
  try {
    return loadConfig(env);
  } catch (error) {
    console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
