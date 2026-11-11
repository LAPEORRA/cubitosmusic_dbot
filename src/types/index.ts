/**
 * Tipos compartidos del bot.
 *
 * La configuración del entorno vive en `src/config.ts` y el contrato de
 * comandos en `src/types/commands.ts`; aquí solo se re-exportan para que
 * `import type { ... } from '../types/index.js'` siga siendo cómodo.
 */
export type { BotConfig } from '../config.js';
export type {
  Command,
  CommandCategory,
  CommandContext,
  CommandData,
} from './commands.js';
