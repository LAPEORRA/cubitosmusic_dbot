import type { Player } from 'discord-player';
import type {
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';

/** Categorías usadas por el registro de comandos (y, más adelante, por `/help`). */
export type CommandCategory =
  | 'music'
  | 'filters'
  | 'playlists'
  | 'settings'
  | 'utility'
  | 'admin';

/**
 * Cualquier builder de slash command válido.
 * Los builders encadenados devuelven variantes "options only" o "subcommands only",
 * así que el contrato debe aceptar las tres formas.
 */
export type CommandData =
  | SlashCommandBuilder
  | SlashCommandOptionsOnlyBuilder
  | SlashCommandSubcommandsOnlyBuilder;

/** Dependencias compartidas que recibe cada comando al ejecutarse. */
export interface CommandContext {
  player: Player;
}

/**
 * Contrato único de un slash command.
 *
 * `interaction` se deja como `any` a propósito: los handlers actuales aceptan
 * formas mínimas (tests incluidos) y tiparlo de forma estricta requiere migrar
 * cada comando. Se irá endureciendo a `ChatInputCommandInteraction` por fases.
 */
export interface Command {
  data: CommandData;
  execute: (interaction: any, context: CommandContext) => Promise<unknown> | unknown;
  category: CommandCategory;
  /** Descripción corta para `/help` (opcional). */
  help?: string;
}
