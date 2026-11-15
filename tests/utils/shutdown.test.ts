import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Client } from 'discord.js';
import type { Player } from 'discord-player';
import { getPanelMessage, setPanelMessage } from '../../src/player/panel/panel.js';
import { createShutdownHandler } from '../../src/utils/shutdown.js';

function fakeQueue(guildId: string) {
  const calls: string[] = [];
  const queue = {
    metadata: { channel: { guildId, name: 'musica' } },
    tracks: { clear: () => calls.push('clear') },
    connection: { disconnect: () => calls.push('disconnect') },
    delete: () => calls.push('delete'),
  };
  return { queue, calls };
}

function fakeClient(options: { destroy?: () => Promise<void> } = {}) {
  const activityCalls: unknown[][] = [];
  let destroyed = 0;
  const client = {
    user: {
      setActivity: (...args: unknown[]) => {
        activityCalls.push(args);
      },
    },
    destroy: async () => {
      destroyed += 1;
      if (options.destroy) await options.destroy();
    },
  };
  return { client, activityCalls, destroyed: () => destroyed };
}

function fakePlayer(queues: unknown[]) {
  return {
    queues: { cache: new Map(queues.map((queue: any) => [queue.metadata.channel.guildId, queue])) },
  };
}

function setPanelSpy(guildId: string) {
  const state = { edits: 0 };
  const message = {
    editable: true,
    deletable: false,
    components: [],
    async edit() {
      state.edits += 1;
      return message;
    },
  };
  setPanelMessage(guildId, message as any);
  return state;
}

async function silenceConsole<T>(task: () => Promise<T>): Promise<T> {
  const originalLog = console.log;
  console.log = () => {};
  try {
    return await task();
  } finally {
    console.log = originalLog;
  }
}

test('el apagado es idempotente: señales repetidas limpian una sola vez', async () => {
  const guildId = `shutdown-${Date.now()}-${Math.random()}`;
  const { queue, calls } = fakeQueue(guildId);
  const panel = setPanelSpy(guildId);
  const { client, activityCalls, destroyed } = fakeClient();
  const exits: number[] = [];

  const shutdown = createShutdownHandler({
    client: client as unknown as Client,
    player: fakePlayer([queue]) as unknown as Player,
    exit: (code) => exits.push(code),
    timeoutMs: 5_000,
  });

  await silenceConsole(() => Promise.all([
    shutdown('SIGINT'),
    shutdown('SIGHUP'),
    shutdown('SIGINT'),
  ]));

  assert.deepEqual(calls, ['clear', 'disconnect', 'delete'], 'stopQueue se ejecuta una sola vez');
  assert.equal(panel.edits, 1, 'updateEmptyPanel se ejecuta una sola vez');
  assert.equal(getPanelMessage(guildId), undefined, 'libera la referencia del panel');
  assert.deepEqual(activityCalls, [[]], 'limpia la presencia');
  assert.equal(destroyed(), 1, 'cierra el cliente una sola vez');
  assert.deepEqual(exits, [0], 'sale con código 0');
});

test('el apagado limpia todas las colas activas antes de cerrar', async () => {
  const guildA = `shutdown-a-${Date.now()}-${Math.random()}`;
  const guildB = `shutdown-b-${Date.now()}-${Math.random()}`;
  const first = fakeQueue(guildA);
  const second = fakeQueue(guildB);
  const panelA = setPanelSpy(guildA);
  const panelB = setPanelSpy(guildB);
  const { client, destroyed } = fakeClient();
  const exits: number[] = [];

  const shutdown = createShutdownHandler({
    client: client as unknown as Client,
    player: fakePlayer([first.queue, second.queue]) as unknown as Player,
    exit: (code) => exits.push(code),
    timeoutMs: 5_000,
  });

  await silenceConsole(() => shutdown('SIGTERM'));

  assert.deepEqual(first.calls, ['clear', 'disconnect', 'delete']);
  assert.deepEqual(second.calls, ['clear', 'disconnect', 'delete']);
  assert.equal(panelA.edits, 1);
  assert.equal(panelB.edits, 1);
  assert.equal(destroyed(), 1);
  assert.deepEqual(exits, [0]);
});

test('si una cola falla, el apagado continúa y sale con código 0', async () => {
  const failingGuild = `shutdown-fail-${Date.now()}-${Math.random()}`;
  const healthyGuild = `shutdown-ok-${Date.now()}-${Math.random()}`;
  const failing = fakeQueue(failingGuild);
  failing.queue.delete = () => {
    throw new Error('queue rota');
  };
  const healthy = fakeQueue(healthyGuild);
  setPanelSpy(healthyGuild);
  const { client, destroyed } = fakeClient();
  const exits: number[] = [];

  const shutdown = createShutdownHandler({
    client: client as unknown as Client,
    player: fakePlayer([failing.queue, healthy.queue]) as unknown as Player,
    exit: (code) => exits.push(code),
    timeoutMs: 5_000,
  });

  await silenceConsole(() => shutdown('SIGINT'));

  assert.deepEqual(healthy.calls, ['clear', 'disconnect', 'delete']);
  assert.equal(destroyed(), 1);
  assert.deepEqual(exits, [0]);
});

test('si client.destroy queda colgado, el temporizador de seguridad llama a exit(0)', async () => {
  const guildId = `shutdown-hang-${Date.now()}-${Math.random()}`;
  const { queue } = fakeQueue(guildId);
  const exits: number[] = [];

  let resolveExit: () => void = () => {};
  const exitCalled = new Promise<void>((resolve) => {
    resolveExit = resolve;
  });
  const guard = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => reject(new Error('exit(0) no se llamó a tiempo')), 2_000);
    timer.unref?.();
  });

  const { client } = fakeClient({ destroy: () => new Promise<void>(() => {}) });

  const shutdown = createShutdownHandler({
    client: client as unknown as Client,
    player: fakePlayer([queue]) as unknown as Player,
    exit: (code) => {
      exits.push(code);
      resolveExit();
    },
    timeoutMs: 25,
  });

  await silenceConsole(async () => {
    void shutdown('SIGTERM');
    await Promise.race([exitCalled, guard]);
  });

  assert.deepEqual(exits, [0], 'el timeout garantiza la salida');
});
