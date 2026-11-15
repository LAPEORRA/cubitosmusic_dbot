import type { Client } from 'discord.js';
import type { Player } from 'discord-player';
import { stopQueue } from '../player/controls.js';
import { updateEmptyPanel } from '../player/panel/panel.js';
import { logRow } from './logger.js';

/** Margen para no dejar el proceso colgado si la API de Discord no responde. */
const DEFAULT_SHUTDOWN_TIMEOUT_MS = 3_000;

export type ShutdownDeps = {
  client: Client;
  player: Player;
  /** Inyectable para tests; por defecto `process.exit`. */
  exit?: (code: number) => void;
  timeoutMs?: number;
};

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Crea el manejador de apagado ordenado.
 *
 * Secuencia: log en la TUI → temporizador de seguridad → limpieza de todas las
 * colas activas (detener + panel de cierre) → limpieza de presencia →
 * `client.destroy()` → `exit(0)`. Es idempotente: señales repetidas no repiten
 * la limpieza.
 */
export function createShutdownHandler({
  client,
  player,
  exit = (code: number) => process.exit(code),
  timeoutMs = DEFAULT_SHUTDOWN_TIMEOUT_MS,
}: ShutdownDeps): (signal: string) => Promise<void> {
  let shuttingDown = false;

  return async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;

    logRow({
      badge: 'STOP',
      color: 'yellow',
      detail: `Apagando bot (${signal})...`,
    });

    // Red de seguridad: si Discord no responde, el proceso igualmente termina.
    const safety = setTimeout(() => exit(0), timeoutMs);
    safety.unref?.();

    try {
      const queues = Array.from(player.queues?.cache?.values?.() ?? []);
      for (const queue of queues) {
        // Capturado antes de `queue.delete()`, que limpia `metadata`.
        const channel = (queue.metadata as any)?.channel;
        try {
          await stopQueue(queue);
          await updateEmptyPanel(channel);
        } catch (error) {
          logRow({
            badge: 'ERROR',
            color: 'red',
            detail: `Error limpiando una cola durante el apagado: ${errorText(error)}`,
          });
        }
      }

      client.user?.setActivity();
      await client.destroy();
    } catch (error) {
      logRow({
        badge: 'ERROR',
        color: 'red',
        detail: `Error durante el apagado: ${errorText(error)}`,
      });
    } finally {
      clearTimeout(safety);
      exit(0);
    }
  };
}

/**
 * Engancha el apagado ordenado a las señales del sistema y al cierre de stdin.
 *
 * - `SIGINT` (Ctrl + C), `SIGTERM` (Docker/sistema), `SIGHUP` y `SIGBREAK`
 *   (cierre de la ventana de consola en Windows).
 * - `stdin` `end`/`close` solo en procesos sin TTY (terminal padre cerrada
 *   abruptamente, p. ej. bajo un supervisor).
 */
export function registerGracefulShutdown(
  client: Client,
  player: Player,
  options: Omit<ShutdownDeps, 'client' | 'player'> = {},
): (signal: string) => Promise<void> {
  const shutdown = createShutdownHandler({ client, player, ...options });

  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK'] as const) {
    process.once(signal, () => {
      void shutdown(signal);
    });
  }

  // Sin TTY (supervisor, Docker sin `-i`, CI) `stdin` se cierra cuando muere la
  // terminal padre. Si ya venía cerrado al arrancar no se engancha nada: hacerlo
  // apagaría el bot inmediatamente sin que nadie lo haya pedido.
  if (!process.stdin.isTTY && !process.stdin.readableEnded) {
    process.stdin.on('end', () => {
      void shutdown('stdin:end');
    });
    process.stdin.on('close', () => {
      void shutdown('stdin:close');
    });
  }

  return shutdown;
}
