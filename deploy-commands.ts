import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { data as playData } from './src/commands/play.js';
import { data as skipData } from './src/commands/skip.js';
import { data as stopData } from './src/commands/stop.js';
import { data as queueData } from './src/commands/queue.js';
import { data as pauseData } from './src/commands/pause.js';
import { data as loopData } from './src/commands/loop.js';
import { data as shuffleData } from './src/commands/shuffle.js';
import { data as nowplayingData } from './src/commands/nowplaying.js';

const clientId = process.env.CLIENT_ID!;
const guildId = process.env.GUILD_ID!;
const token = process.env.DISCORD_TOKEN!;

const commands = [
  playData.toJSON(),
  skipData.toJSON(),
  stopData.toJSON(),
  queueData.toJSON(),
  pauseData.toJSON(),
  loopData.toJSON(),
  shuffleData.toJSON(),
  nowplayingData.toJSON(),
];

console.log(`📤 Registrando ${commands.length} comandos:`, commands.map(c => c.name));

const rest = new REST({ version: '10' }).setToken(token);

try {
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
  console.log(`✅ ${commands.length} comandos registrados en guild ${guildId}`);
} catch (error) {
  console.error('❌ Error:', error);
}
