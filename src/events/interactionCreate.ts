import { InteractionType } from 'discord.js';
import type { Player } from 'discord-player';
import { getCommand } from '../commands/index.js';
import { handlePanelButton } from '../player/panel/panel-buttons.js';
import { logRow, traceEvent } from '../utils/logger.js';
import { isInteractionConsumedError, replyWithError } from './interactionResponses.js';

/** TTL para deduplicar entregas repetidas del mismo evento de Discord. */
const HANDLED_INTERACTION_TTL_MS = 15_000;

/** IDs de interacciones ya procesadas (evita ejecuciones duplicadas). */
const handledInteractions = new Set<string>();

function markHandled(interactionId: string): void {
  handledInteractions.add(interactionId);
  const timer = setTimeout(() => handledInteractions.delete(interactionId), HANDLED_INTERACTION_TTL_MS);
  // En tests el proceso no debe quedarse vivo esperando el TTL.
  timer.unref?.();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function logInteractionError(interaction: any, error: unknown, context: string): void {
  if (isInteractionConsumedError(error)) {
    const code = (error as { code: number }).code;
    logRow({
      badge: 'ERROR',
      color: 'red',
      channel: interaction.channel?.name,
      detail: `Interacción expirada o ya respondida (${code})`,
    });
    return;
  }

  logRow({
    badge: 'ERROR',
    color: 'red',
    channel: interaction.channel?.name,
    detail: `${context}: ${errorMessage(error)}`,
  });
}

/**
 * Registra el fallo en la TUI y responde al usuario solo si la interacción
 * sigue viva. Los códigos 10062/40060 se consideran ya consumidos.
 */
export async function handleInteractionFailure(
  interaction: any,
  error: unknown,
  context: string,
  fallbackMessage: string,
): Promise<void> {
  logInteractionError(interaction, error, context);
  if (isInteractionConsumedError(error)) return;
  await replyWithError(interaction, fallbackMessage);
}

/**
 * Router de interacciones.
 *
 * - Botones con customId `panel_*` -> panel interactivo.
 * - Slash commands -> registro tipado de `commands/index.ts` (sin `switch`).
 */
export const interactionCreate = async (interaction: any, player: Player) => {
  const receivedAt = performance.now();
  const isButtonInteraction = interaction.type === InteractionType.MessageComponent
    && interaction.isButton
    && interaction.isButton();
  if (isButtonInteraction) {
    traceEvent('timing', 'button_received', {
      interactionId: interaction.id,
      customId: interaction.customId,
      receivedAt,
    });
  } else if (interaction.type === InteractionType.ApplicationCommand) {
    traceEvent('timing', 'command_received', {
      interactionId: interaction.id,
      commandName: interaction.commandName,
      receivedAt,
    });
  }

  const interactionId = interaction.id as string | undefined;
  if (interactionId) {
    if (handledInteractions.has(interactionId)) return;
    markHandled(interactionId);
  }

  if (isButtonInteraction) {
    if (interaction.customId?.startsWith('panel_')) {
      try {
        await handlePanelButton(interaction);
      } catch (error) {
        await handleInteractionFailure(
          interaction,
          error,
          `Error en botón ${interaction.customId}`,
          '❌ Ocurrió un error al procesar el botón.',
        );
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
    logRow({
      badge: 'CMD',
      color: 'magenta',
      channel: interaction.channel?.name,
      detail: `Usuario /${commandName}`,
    });
    await command.execute(interaction, { player });
  } catch (error) {
    await handleInteractionFailure(
      interaction,
      error,
      `Error en /${commandName}`,
      '❌ Ocurrió un error al ejecutar el comando.',
    );
  }
};
