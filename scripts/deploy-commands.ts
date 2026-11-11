import 'dotenv/config';
import { REST, Routes, type RESTPostAPIApplicationCommandsJSONBody } from 'discord.js';
import { commands } from '../src/commands/index.js';

const token = process.env.DISCORD_TOKEN?.trim();
const clientId = process.env.CLIENT_ID?.trim();
const guildId = process.env.GUILD_ID?.trim();
const globalScope = process.argv.includes('--global');

if (!token || !clientId || (!globalScope && !guildId)) {
  console.error(
    '❌ Faltan variables de entorno: ' +
      [
        !token && 'DISCORD_TOKEN',
        !clientId && 'CLIENT_ID',
        !globalScope && !guildId && 'GUILD_ID',
      ]
        .filter(Boolean)
        .join(', '),
  );
  process.exit(1);
}

const body: RESTPostAPIApplicationCommandsJSONBody[] = commands.map((command) =>
  command.data.toJSON(),
);

const scope = globalScope ? 'global' : `guild ${guildId}`;
console.log(`📤 Registrando ${body.length} comandos (${scope}):`, body.map((c) => c.name));

const rest = new REST({ version: '10' }).setToken(token);
const route = globalScope
  ? Routes.applicationCommands(clientId!)
  : Routes.applicationGuildCommands(clientId!, guildId!);

try {
  await rest.put(route, { body });
  console.log(`✅ ${body.length} comandos registrados (${scope})`);
} catch (error) {
  console.error('❌ Error registrando comandos:', error);
  process.exit(1);
}
