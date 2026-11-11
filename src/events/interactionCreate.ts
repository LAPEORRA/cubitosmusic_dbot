import { InteractionType } from 'discord.js';
import type { Player } from 'discord-player';
import { getCommand } from '../commands/index.js';
import { handlePanelButton } from '../player/panel/panel-buttons.js';
import { replyWithError } from './interactionResponses.js';

/**
 * Router de interacciones.
 *
 * - Botones con customId `panel_*` -> panel interactivo.
 * - Slash commands -> registro tipado de `commands/index.ts` (sin `switch`).
 */
export const interactionCreate = async (interaction: any, player: Player) => {
  if (
    interaction.type === InteractionType.MessageComponent &&
    interaction.isButton &&
    interaction.isButton()
  ) {
    if (interaction.customId?.startsWith('panel_')) {
      try {
        await handlePanelButton(interaction);
      } catch (error) {
        console.error(`❌ Error en botón ${interaction.customId}:`, error);
        await replyWithError(interaction, '❌ Ocurrió un error al procesar el botón.');
      }
      return;
    }
  }

  if (interaction.type !== InteractionType.ApplicationCommand) return;

  const { commandName } = interaction;
  const command = getCommand(commandName);

  if (!command) {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ Comando desconocido.', flags: 64 });
    }
    return;
  }

  try {
    await command.execute(interaction, { player });
  } catch (error) {
    console.error(`❌ Error en /${commandName}:`, error);
    await replyWithError(interaction, '❌ Ocurrió un error al ejecutar el comando.');
  }
};
