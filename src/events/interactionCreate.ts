import { Events, InteractionType } from 'discord.js';
import { SlashCommandBuilder } from 'discord.js';

export const interactionCreate = async (interaction) => {
  if (interaction.type === InteractionType.ApplicationCommand) {
    const { commandName } = interaction;

    switch (commandName) {
      case 'play':
        // Se importará dinámicamente para evitar circular dependencies
        await interaction.reply({ content: 'Comando play detectado, procesando...', ephemeral: true });
        break;

      case 'skip':
        await interaction.reply({ content: 'Comando skip detectado', ephemeral: true });
        break;

      case 'stop':
        await interaction.reply({ content: 'Comando stop detectado', ephemeral: true });
        break;

      case 'queue':
        await interaction.reply({ content: 'Comando queue detectado', ephemeral: true });
        break;

      case 'pause':
        await interaction.reply({ content: 'Comando pause detectado', ephemeral: true });
        break;

      default:
        console.log(`Comando desconocido: ${commandName}`);
    }
  }
};

export default { interactionCreate };