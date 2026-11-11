import type { Command } from '../types/commands.js';

import { data as playData, play } from './music/play.js';
import { data as skipData, skip } from './music/skip.js';
import { data as stopData, stop } from './music/stop.js';
import { data as queueData, queue } from './music/queue.js';
import { data as pauseData, pause } from './music/pause.js';
import { data as loopData, loop } from './music/loop.js';
import { data as shuffleData, shuffle } from './music/shuffle.js';
import { data as nowplayingData, nowplaying } from './music/nowplaying.js';

/**
 * Registro único de comandos.
 *
 * Es la fuente de verdad tanto para el router (`events/interactionCreate.ts`)
 * como para el despliegue (`scripts/deploy-commands.ts`). Para añadir un comando
 * basta con crear el archivo, importarlo aquí y añadir su entrada.
 */
export const commands: Command[] = [
  {
    data: playData,
    category: 'music',
    help: 'Reproduce una canción, playlist o búsqueda.',
    execute: (interaction, { player }) => play(interaction, player),
  },
  {
    data: skipData,
    category: 'music',
    help: 'Salta a la siguiente pista.',
    execute: (interaction) => skip(interaction),
  },
  {
    data: stopData,
    category: 'music',
    help: 'Detiene la reproducción y limpia la cola.',
    execute: (interaction) => stop(interaction),
  },
  {
    data: queueData,
    category: 'music',
    help: 'Muestra la cola de reproducción.',
    execute: (interaction) => queue(interaction),
  },
  {
    data: pauseData,
    category: 'music',
    help: 'Pausa o reanuda la reproducción.',
    execute: (interaction) => pause(interaction),
  },
  {
    data: loopData,
    category: 'music',
    help: 'Activa o desactiva la repetición de la pista.',
    execute: (interaction) => loop(interaction),
  },
  {
    data: shuffleData,
    category: 'music',
    help: 'Mezcla el orden de la cola.',
    execute: (interaction) => shuffle(interaction),
  },
  {
    data: nowplayingData,
    category: 'music',
    help: 'Muestra la canción actual.',
    execute: (interaction) => nowplaying(interaction),
  },
];

/** Índice por nombre para resolver el comando de una interacción en O(1). */
export const commandsByName: ReadonlyMap<string, Command> = new Map(
  commands.map((command) => [command.data.name, command]),
);

export function getCommand(name: string): Command | undefined {
  return commandsByName.get(name);
}
