import { InteractionType } from 'discord.js';
import { Player } from 'discord-player';
import { play } from '../commands/play.js';
import { skip } from '../commands/skip.js';
import { stop } from '../commands/stop.js';
import { queue } from '../commands/queue.js';
import { pause } from '../commands/pause.js';
import { loop } from '../commands/loop.js';
import { shuffle } from '../commands/shuffle.js';
import { nowplaying } from '../commands/nowplaying.js';
import { handlePanelButton } from '../player/panel-buttons.js';

export const interactionCreate = async (interaction: any, player: Player) => {
  // Botones del panel interactivo
  if (interaction.type === InteractionType.MessageComponent && interaction.isButton && interaction.isButton()) {
    if (interaction.customId?.startsWith('panel_')) {
      try {
        await handlePanelButton(interaction);
      } catch (error) {
        console.error(`❌ Error en botón ${interaction.customId}:`, error);
        try {
          await interaction.followUp({ content: '❌ Ocurrió un error al procesar el botón.', flags: 64, ephemeral: true });
        } catch {}
      }
      return;
    }
  }

  if (interaction.type !== InteractionType.ApplicationCommand) return;

  const { commandName } = interaction;

  try {
    switch (commandName) {
      case 'play':
        await play(interaction, player);
        break;
      case 'skip':
        await skip(interaction);
        break;
      case 'stop':
        await stop(interaction);
        break;
      case 'queue':
        await queue(interaction, player);
        break;
      case 'pause':
        await pause(interaction);
        break;
      case 'loop':
        await loop(interaction);
        break;
      case 'shuffle':
        await shuffle(interaction);
        break;
      case 'nowplaying':
        await nowplaying(interaction);
        break;
      default:
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '❌ Comando desconocido.', flags: 64 });
        }
    }
  } catch (error) {
    console.error(`❌ Error en /${commandName}:`, error);
    try {
      const msg = { content: '❌ Ocurrió un error al ejecutar el comando.', flags: 64 };
      if (interaction.deferred) {
        await interaction.editReply(msg);
      } else if (!interaction.replied) {
        await interaction.reply(msg);
      }
    } catch {}
  }
};