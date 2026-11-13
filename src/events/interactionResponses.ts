import { logRow } from '../utils/logger.js';

/**
 * Códigos de Discord para interacciones ya consumidas:
 * - 10062: Unknown interaction (expirada)
 * - 40060: Interaction has already been acknowledged
 */
export function isInteractionConsumedError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null | undefined)?.code;
  return code === 10062 || code === 40060;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function replyWithError(interaction: any, content: string): Promise<void> {
  try {
    const payload = { content, flags: 64 };
    if (interaction.deferred) {
      await interaction.editReply(payload);
    } else if (interaction.replied) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  } catch (error) {
    // La interacción expiró o ya fue respondida: no hay nada que hacer y no
    // debe ensuciar la TUI con un stack trace.
    if (isInteractionConsumedError(error)) return;

    logRow({
      badge: 'ERROR',
      color: 'red',
      channel: interaction?.channel?.name,
      detail: `No se pudo responder al error de interacción: ${errorMessage(error)}`,
    });
  }
}
