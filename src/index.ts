import 'dotenv/config';
import { Client, Events, IntentsBitField, GatewayIntentBits } from 'discord.js';
import { ready } from './events/ready';
import { interactionCreate } from './events/interactionCreate';
import { config } from './types';

// Cargar variables de entorno
const discordToken = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!discordToken || !clientId || !guildId) {
  console.error('❌ Faltan variables de entorno en .env');
  process.exit(1);
}

// Crear cliente de Discord con los intents necesarios
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
  ],
});

// Cargar eventos
client.on(Events.ClientReady, () => ready(client as any));
client.on(Events.InteractionCreate, interaction => interactionCreate(interaction as any));

// Iniciar bot
client.login(discordToken).then(() => {
  console.log('🚀 Bot iniciado, esperando eventos de Discord...');
}).catch(err => {
  console.error('❌ Error login:', err);
});