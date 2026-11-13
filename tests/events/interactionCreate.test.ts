import assert from 'node:assert/strict';
import { test } from 'node:test';
import { InteractionType } from 'discord.js';
import type { Player } from 'discord-player';
import {
  handleInteractionFailure,
  interactionCreate,
} from '../../src/events/interactionCreate.js';

const player = {} as Player;

function createUnknownCommandInteraction(id: string) {
  const replies: any[] = [];
  return {
    interaction: {
      id,
      type: InteractionType.ApplicationCommand,
      commandName: 'comando-inexistente',
      channel: { name: 'musica' },
      replied: false,
      deferred: false,
      reply: async (payload: any) => {
        replies.push(payload);
      },
    },
    replies,
  };
}

async function captureLogs<T>(run: () => Promise<T>): Promise<{ result: T; logs: string[]; errors: unknown[] }> {
  const logs: string[] = [];
  const errors: unknown[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args: unknown[]) => logs.push(args.join(' '));
  console.error = (...args: unknown[]) => errors.push(args);
  try {
    const result = await run();
    return { result, logs, errors };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

test('ignora una segunda entrega de la misma interacción', async () => {
  const id = `dup-${Date.now()}-${Math.random()}`;
  const { interaction, replies } = createUnknownCommandInteraction(id);

  await interactionCreate(interaction, player);
  await interactionCreate(interaction, player);

  assert.equal(replies.length, 1);
});

test('procesa interacciones distintas aunque lleguen seguidas', async () => {
  const first = createUnknownCommandInteraction(`a-${Date.now()}-${Math.random()}`);
  const second = createUnknownCommandInteraction(`b-${Date.now()}-${Math.random()}`);

  await interactionCreate(first.interaction, player);
  await interactionCreate(second.interaction, player);

  assert.equal(first.replies.length, 1);
  assert.equal(second.replies.length, 1);
});

test('handleInteractionFailure no responde si la interacción expiró (10062)', async () => {
  const replies: any[] = [];
  const interaction = {
    channel: { name: 'musica' },
    reply: async (payload: any) => {
      replies.push(payload);
    },
  };

  const error = Object.assign(new Error('Unknown interaction'), { code: 10062 });
  const { logs, errors } = await captureLogs(() =>
    handleInteractionFailure(interaction, error, 'Error en /play', '❌ Falló'),
  );

  assert.equal(replies.length, 0, 'no debe intentar responder');
  assert.deepEqual(errors, []);
  assert.equal(logs.length, 1);
  assert.match(logs[0], /\[ERROR\]/);
  assert.match(logs[0], /Interacción expirada o ya respondida \(10062\)/);
});

test('handleInteractionFailure registra con logRow y responde ante errores reales', async () => {
  const replies: any[] = [];
  const interaction = {
    channel: { name: 'musica' },
    reply: async (payload: any) => {
      replies.push(payload);
    },
  };

  const { logs, errors } = await captureLogs(() =>
    handleInteractionFailure(interaction, new Error('boom'), 'Error en /play', '❌ Falló'),
  );

  assert.deepEqual(errors, []);
  assert.equal(logs.length, 1);
  assert.match(logs[0], /Error en \/play: boom/);
  assert.equal(replies.length, 1);
  assert.equal(replies[0].content, '❌ Falló');
});
