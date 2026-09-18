import { REST, Routes } from 'discord.js';
import { readdirSync, statSync } from 'fs';
import path from 'path';

// Tu client ID y guild ID del .env
const clientId = process.env.CLIENT_ID!;
const guildId = process.env.GUILD_ID!;

// Rutas de los comandos
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));

const commands = [];

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = await import(filePath);

  // Cada comando debe exportar 'data' que es un SlashCommandBuilder
  if ('data' in command.default) {
    commands.push(command.default.data.toJSON());
  }
}

// Inicializar REST
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

(async () => {
  try {
    console.log(`📤 Registrando ${commands.length} comandos slash...`);

    // Registrar comandos globalmente (tarda hasta 1 hora en propagarse)
    // O registrarlos en el guild específico para desarrollo instantáneo
    const data = await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands }
    );

    console.log(`✅ ${data.length} comandos registrados en guild ${guildId}`);
  } catch (error) {
    console.error('❌ Error registrando comandos:', error);
  }
})();