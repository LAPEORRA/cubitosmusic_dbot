import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isSameVoiceChannel } from '../../src/player/controls.js';

test('allows control from the bot voice channel', () => {
  assert.equal(isSameVoiceChannel('voice-1', 'voice-1'), true);
});

test('denies control from a different voice channel', () => {
  assert.equal(isSameVoiceChannel('voice-2', 'voice-1'), false);
});

test('denies control when either voice channel is missing', () => {
  assert.equal(isSameVoiceChannel(null, 'voice-1'), false);
  assert.equal(isSameVoiceChannel('voice-1', null), false);
});
