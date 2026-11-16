import dotenv from 'dotenv';
import { Client, Events, GatewayIntentBits } from 'discord.js';
import { Player } from 'discord-player';
import { DefaultExtractors } from '@discord-player/extractor';
import { YouTubeDlpMixExtractor } from './player/extractors/youtubeDlpMix.js';
import { ready } from './events/ready.js';
import { interactionCreate } from './events/interactionCreate.js';
import { loadConfigOrExit } from './config.js';
import { printBootHeader } from './utils/logger.js';
import { registerGracefulShutdown } from './utils/shutdown.js';

dotenv.config({ quiet: true });
printBootHeader();

const config = loadConfigOrExit();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const player = new Player(client as any);

// Configurar opciones de extractores con credenciales
const extractorOptions: Record<string, any> = {};

if (config.spotify) {
  extractorOptions['com.discord-player.spotifyextractor'] = {
    clientId: config.spotify.clientId,
    clientSecret: config.spotify.clientSecret,
  };
}

// Cargar extractores defaults primero, luego YouTube (yt-dlp) con prioridad.
// YouTubeDlpMixExtractor extiende YouTubeDlpExtractor para que los radio mixes
// (list=RD*) se resuelvan como playlist en vez de video único.
await player.extractors.loadMulti(DefaultExtractors, extractorOptions);
await player.extractors.register(YouTubeDlpMixExtractor, {
  agent: { autoCookiesFromBrowser: false },
  searchLimit: 3,
  playlistTimeoutMs: 30000,
  ytdlpTimeoutMs: 30000,
});

client.on(Events.ClientReady, () => ready(client, player, config.guildId, Boolean(config.spotify)));
client.on(Events.InteractionCreate, (interaction) => interactionCreate(interaction, player));

client.login(config.discordToken).catch((err) => {
  console.error('❌ Error login:', err);
});

// Apagado ordenado: Ctrl + C / cierre de consola detienen música, deshabilitan
// el panel y cierran la conexión antes de salir.
registerGracefulShutdown(client, player);
