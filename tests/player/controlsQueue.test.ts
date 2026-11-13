import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GuildQueue } from 'discord-player';
import { clearQueue, removeTrack, skipTo } from '../../src/player/controls.js';

interface FakeTrack {
  id: string;
  title: string;
}

function fakeQueue(titles: string[], acceptsSkip: (index: number) => boolean = () => true) {
  const store: FakeTrack[] = titles.map((title) => ({ id: title, title }));
  const skipCalls: number[] = [];

  const tracks = {
    get size() {
      return store.length;
    },
    get data() {
      return store;
    },
    at: (index: number) => store[index],
    clear: () => {
      store.length = 0;
    },
    removeOne: (filter: (track: FakeTrack, index: number) => boolean) => {
      const index = store.findIndex(filter);
      if (index > -1) store.splice(index, 1);
    },
  };

  const node = {
    skipTo: (index: number) => {
      skipCalls.push(index);
      return acceptsSkip(index);
    },
  };

  return {
    queue: { tracks, node } as unknown as GuildQueue,
    store,
    skipCalls,
  };
}

test('clearQueue devuelve false cuando la cola está vacía', () => {
  const { queue, store } = fakeQueue([]);
  assert.equal(clearQueue(queue), false);
  assert.equal(store.length, 0);
});

test('clearQueue vacía la cola y devuelve true si había canciones', () => {
  const { queue, store } = fakeQueue(['a', 'b', 'c']);
  assert.equal(clearQueue(queue), true);
  assert.equal(store.length, 0);
});

test('removeTrack elimina la posición indicada (1-based) y devuelve la pista', () => {
  const { queue, store } = fakeQueue(['a', 'b', 'c']);
  const removed = removeTrack(queue, 2);
  assert.equal(removed?.title, 'b');
  assert.deepEqual(store.map((track) => track.title), ['a', 'c']);
});

test('removeTrack puede eliminar la primera y la última posición', () => {
  const first = fakeQueue(['a', 'b', 'c']);
  assert.equal(removeTrack(first.queue, 1)?.title, 'a');
  assert.deepEqual(first.store.map((track) => track.title), ['b', 'c']);

  const last = fakeQueue(['a', 'b', 'c']);
  assert.equal(removeTrack(last.queue, 3)?.title, 'c');
  assert.deepEqual(last.store.map((track) => track.title), ['a', 'b']);
});

test('removeTrack devuelve null y no altera la cola con posición inválida', () => {
  const { queue, store } = fakeQueue(['a', 'b']);
  assert.equal(removeTrack(queue, 3), null);
  assert.equal(removeTrack(queue, 0), null);
  assert.deepEqual(store.map((track) => track.title), ['a', 'b']);
});

test('skipTo convierte la posición 1-based al índice del player y devuelve la pista', () => {
  const { queue, skipCalls } = fakeQueue(['a', 'b', 'c']);
  assert.equal(skipTo(queue, 3)?.title, 'c');
  assert.deepEqual(skipCalls, [2]);

  const first = fakeQueue(['a', 'b']);
  assert.equal(skipTo(first.queue, 1)?.title, 'a');
  assert.deepEqual(first.skipCalls, [0]);
});

test('skipTo devuelve null si el player rechaza el salto', () => {
  const { queue, skipCalls } = fakeQueue(['a', 'b'], () => false);
  assert.equal(skipTo(queue, 2), null);
  assert.deepEqual(skipCalls, [1]);
});

test('skipTo devuelve null y no llama al player si la posición no existe', () => {
  const { queue, skipCalls } = fakeQueue(['a', 'b']);
  assert.equal(skipTo(queue, 3), null);
  assert.equal(skipTo(queue, 0), null);
  assert.deepEqual(skipCalls, []);
});
