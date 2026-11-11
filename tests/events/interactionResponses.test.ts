import assert from 'node:assert/strict';
import { test } from 'node:test';
import { replyWithError } from '../../src/events/interactionResponses.js';

function createInteraction(state: 'new' | 'deferred' | 'replied') {
  const calls: string[] = [];
  const interaction = {
    deferred: state === 'deferred',
    replied: state === 'replied',
    async reply() {
      calls.push('reply');
    },
    async editReply() {
      calls.push('editReply');
    },
    async followUp() {
      calls.push('followUp');
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
