import 'dotenv/config';
import { Client, Events, GatewayIntentBits } from 'discord.js';
import { Player } from 'discord-player';
import { DefaultExtractors } from '@discord-player/extractor';
import { YouTubeDlpMixExtractor } from './player/extractors/youtubeDlpMix.js';
import { ready } from './events/ready.js';
import { interactionCreate } from './events/interactionCreate.js';
import { loadConfigOrExit } from './config.js';

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
  console.log('✅ Spotify configurado con credenciales');
} else {
  console.log('⚠️ Spotify sin credenciales (SPOTIFY_CLIENT_ID/SECRET no configurados)');
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

// Log de extractores registrados
const registered = player.extractors.store;
console.log('📋 Extractores:', Array.from(registered.values()).map((e: any) => `${e.constructor.name}(p${e.priority})`).join(', '));

client.on(Events.ClientReady, () => ready(client, player, config.guildId));
client.on(Events.InteractionCreate, (interaction) => interactionCreate(interaction, player));

client.login(config.discordToken).then(() => {
  console.log('🚀 Bot listo');
}).catch(err => {
  console.error('❌ Error login:', err);
});
