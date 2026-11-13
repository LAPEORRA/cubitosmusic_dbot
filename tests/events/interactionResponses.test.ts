import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isInteractionConsumedError,
  replyWithError,
} from '../../src/events/interactionResponses.js';

function createInteraction(
  state: 'new' | 'deferred' | 'replied',
  replyError?: unknown,
) {
  const calls: string[] = [];
  const interaction = {
    channel: { name: 'musica' },
    deferred: state === 'deferred',
    replied: state === 'replied',
    async reply() {
      calls.push('reply');
      if (replyError) throw replyError;
    },
    async editReply() {
      calls.push('editReply');
      if (replyError) throw replyError;
    },
    async followUp() {
      calls.push('followUp');
      if (replyError) throw replyError;
    },
  };
  return { interaction, calls };
}

test('replies to an interaction that has not been acknowledged', async () => {
  const { interaction, calls } = createInteraction('new');
  await replyWithError(interaction, 'error');
  assert.deepEqual(calls, ['reply']);
});

test('edits a deferred interaction', async () => {
  const { interaction, calls } = createInteraction('deferred');
  await replyWithError(interaction, 'error');
  assert.deepEqual(calls, ['editReply']);
});

test('follows up to an already replied interaction', async () => {
  const { interaction, calls } = createInteraction('replied');
  await replyWithError(interaction, 'error');
  assert.deepEqual(calls, ['followUp']);
});

test('isInteractionConsumedError reconoce 10062 y 40060', () => {
  assert.equal(isInteractionConsumedError({ code: 10062 }), true);
  assert.equal(isInteractionConsumedError({ code: 40060 }), true);
  assert.equal(isInteractionConsumedError({ code: 50013 }), false);
  assert.equal(isInteractionConsumedError(new Error('boom')), false);
  assert.equal(isInteractionConsumedError(null), false);
});

test('ignora silenciosamente los errores 10062/40060 al responder', async () => {
  for (const code of [10062, 40060]) {
    const error = Object.assign(new Error('interaction consumed'), { code });
    const { interaction } = createInteraction('new', error);

    const logs: string[] = [];
    const errors: unknown[] = [];
    const originalLog = console.log;
    const originalError = console.error;
    console.log = (...args: unknown[]) => logs.push(args.join(' '));
    console.error = (...args: unknown[]) => errors.push(args);
    try {
      await replyWithError(interaction, 'error');
    } finally {
      console.log = originalLog;
      console.error = originalError;
    }

    assert.deepEqual(logs, [], `no debe escribir en la TUI (code ${code})`);
    assert.deepEqual(errors, [], `no debe usar console.error (code ${code})`);
  }
});

test('registra con logRow (no console.error) los errores inesperados', async () => {
  const { interaction } = createInteraction('new', new Error('sin permisos'));

  const logs: string[] = [];
  const errors: unknown[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args: unknown[]) => logs.push(args.join(' '));
  console.error = (...args: unknown[]) => errors.push(args);
  try {
    await replyWithError(interaction, 'error');
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }

  assert.deepEqual(errors, []);
  assert.equal(logs.length, 1);
  assert.match(logs[0], /\[ERROR\]/);
  assert.match(logs[0], /No se pudo responder al error de interacción/);
});
