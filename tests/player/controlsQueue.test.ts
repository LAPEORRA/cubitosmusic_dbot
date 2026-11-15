import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GuildQueue } from 'discord-player';
import {
  applyInitialVolume,
  backTrack,
  clearQueue,
  getDesiredVolume,
  reapplyVolumeWhenPlaying,
  removeTrack,
  setQueueVolume,
  skipTo,
  skipTrack,
  stopQueue,
} from '../../src/player/controls.js';

interface FakeTrack {
  id: string;
  title: string;
}

function fakeQueue(
  titles: string[],
  acceptsSkip: (index: number) => boolean = () => true,
  initiallyPaused = false,
  hasHistory = true,
) {
  const store: FakeTrack[] = titles.map((title) => ({ id: title, title }));
  const skipCalls: number[] = [];
  const events: string[] = [];
  let paused = initiallyPaused;

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
      events.push('clear');
    },
    removeOne: (filter: (track: FakeTrack, index: number) => boolean) => {
      const index = store.findIndex(filter);
      if (index > -1) store.splice(index, 1);
    },
  };

  const node = {
    isPaused: () => paused,
    pause: () => {
      paused = true;
      events.push('pause');
    },
    resume: () => {
      paused = false;
      events.push('resume');
    },
    skip: () => {
      events.push('skip');
    },
    skipTo: (index: number) => {
      skipCalls.push(index);
      events.push(`skipTo:${index}`);
      return acceptsSkip(index);
    },
  };

  const history = {
    isEmpty: () => !hasHistory,
    previous: async () => {
      events.push('previous');
    },
  };

  const connection = {
    disconnect: () => {
      events.push('disconnect');
    },
  };

  return {
    queue: {
      tracks,
      node,
      history,
      connection,
      delete: () => {
        events.push('delete');
      },
      isPlaying: () => !paused,
    } as unknown as GuildQueue,
    store,
    skipCalls,
    events,
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

test('skipTrack reanuda antes de saltar cuando el player está en pausa', () => {
  const { queue, events } = fakeQueue(['a', 'b'], () => true, true);
  assert.equal(skipTrack(queue), true);
  assert.deepEqual(events, ['resume', 'skip']);
});

test('skipTrack no reanuda si el player no está en pausa', () => {
  const { queue, events } = fakeQueue(['a', 'b']);
  assert.equal(skipTrack(queue), true);
  assert.deepEqual(events, ['skip']);
});

test('skipTo reanuda antes de saltar cuando el player está en pausa', () => {
  const { queue, events } = fakeQueue(['a', 'b'], () => true, true);
  assert.equal(skipTo(queue, 2)?.title, 'b');
  assert.deepEqual(events, ['resume', 'skipTo:1']);
});

test('backTrack reanuda antes de retroceder cuando el player está en pausa', async () => {
  const { queue, events } = fakeQueue(['a'], () => true, true);
  assert.equal(await backTrack(queue), true);
  assert.deepEqual(events, ['resume', 'previous']);
});

test('backTrack no reanuda si no hay historial', async () => {
  const { queue, events } = fakeQueue(['a'], () => true, true, false);
  assert.equal(await backTrack(queue), false);
  assert.deepEqual(events, []);
});

test('stopQueue limpia las pistas antes de desconectar y borrar la cola', async () => {
  const { queue, events, store } = fakeQueue(['a', 'b']);
  await stopQueue(queue);
  assert.deepEqual(events, ['clear', 'disconnect', 'delete']);
  assert.equal(store.length, 0);
});

test('stopQueue elimina la cola aunque no haya conexión activa', async () => {
  const { queue, events } = fakeQueue(['a']);
  (queue as unknown as { connection: unknown }).connection = null;
  await stopQueue(queue);
  assert.deepEqual(events, ['clear', 'delete']);
});

interface FakeVolumeQueueOptions {
  reportedVolume?: number;
  withDispatcher?: boolean;
  nodeIgnoresVolume?: boolean;
  audioPlayer?: FakeAudioPlayer;
}

interface FakeAudioPlayer {
  state: { status: string };
  on: (event: string, listener: (...args: any[]) => void) => void;
  off: (event: string, listener: (...args: any[]) => void) => void;
  emit: (event: string, ...args: any[]) => void;
  listenerCount: () => number;
}

function fakeAudioPlayer(status = 'buffering'): FakeAudioPlayer {
  const listeners = new Map<string, Set<(...args: any[]) => void>>();
  return {
    state: { status },
    on(event, listener) {
      const set = listeners.get(event) ?? new Set();
      set.add(listener);
      listeners.set(event, set);
    },
    off(event, listener) {
      listeners.get(event)?.delete(listener);
    },
    emit(event, ...args) {
      for (const listener of [...(listeners.get(event) ?? [])]) listener(...args);
    },
    listenerCount: () => listeners.get('stateChange')?.size ?? 0,
  };
}

/**
 * Cola que reproduce el comportamiento real de discord-player:
 * `node.setVolume` delega en `dispatcher.dsp.volume` (el transformer), pero sale
 * en silencio cuando el dispatcher no existe.
 */
function fakeVolumeQueue(options: FakeVolumeQueueOptions = {}) {
  const nodeVolumeCalls: number[] = [];
  const transformerCalls: number[] = [];
  let reported = options.reportedVolume ?? 100;

  const transformer = {
    get volume() {
      return reported;
    },
    setVolume(value: number) {
      transformerCalls.push(value);
      reported = value;
      return true;
    },
  };

  const node = {
    get volume() {
      return reported;
    },
    setVolume(value: number) {
      nodeVolumeCalls.push(value);
      if (!options.withDispatcher || options.nodeIgnoresVolume) return false;
      transformer.setVolume(value);
      return true;
    },
  };

  const queue = {
    node,
    guild: { id: 'guild-1' },
    dispatcher: options.withDispatcher === false
      ? null
      : { dsp: { volume: transformer }, audioPlayer: options.audioPlayer },
  } as unknown as GuildQueue;

  return { queue, nodeVolumeCalls, transformerCalls, transformer };
}

test('applyInitialVolume aplica la ganancia real aunque queue.node.volume ya reporte 70', () => {
  const { queue, nodeVolumeCalls, transformerCalls } = fakeVolumeQueue({ reportedVolume: 70 });

  assert.equal(applyInitialVolume(queue, 70), 70);
  assert.deepEqual(nodeVolumeCalls, [70], 'debe fijar el volumen del nodo');
  assert.deepEqual(transformerCalls, [70], 'debe escribir en el VolumeTransformer activo');
});

test('applyInitialVolume escribe en el transformer aunque el nodo ignored el volumen', () => {
  const { queue, transformerCalls } = fakeVolumeQueue({ nodeIgnoresVolume: true });

  assert.equal(applyInitialVolume(queue, 70), 70);
  assert.deepEqual(transformerCalls, [70], 'la ganancia real no depende del nodo');
});

test('applyInitialVolume sin dispatcher no lanza y recuerda el volumen deseado', () => {
  const { queue, nodeVolumeCalls, transformerCalls } = fakeVolumeQueue({ withDispatcher: false });

  assert.equal(applyInitialVolume(queue, 55), 55);
  assert.deepEqual(nodeVolumeCalls, [55]);
  assert.deepEqual(transformerCalls, []);
  assert.equal(getDesiredVolume(queue), 55);
  assert.equal(getDesiredVolume(queue, 70), 55);
});

test('applyInitialVolume clampa valores fuera de rango y sin número', () => {
  const { queue, transformerCalls } = fakeVolumeQueue();

  assert.equal(applyInitialVolume(queue, 140), 100);
  assert.equal(applyInitialVolume(queue, -5), 0);
  assert.equal(applyInitialVolume(queue, Number.NaN), 70);
  assert.deepEqual(transformerCalls, [100, 0, 70]);
});

test('setQueueVolume recuerda el volumen elegido para las siguientes pistas', () => {
  const { queue, transformerCalls } = fakeVolumeQueue({ reportedVolume: 70 });

  assert.equal(setQueueVolume(queue, 45), 45);
  assert.equal(getDesiredVolume(queue), 45);
  assert.deepEqual(transformerCalls, [45]);
  assert.equal(setQueueVolume(queue, 0), null);
  assert.equal(getDesiredVolume(queue), 45, 'un valor inválido no altera el volumen deseado');
});

test('reapplyVolumeWhenPlaying reaplica el volumen al entrar en playing y no duplica listeners', () => {
  const audioPlayer = fakeAudioPlayer('buffering');
  const { queue, transformerCalls } = fakeVolumeQueue({ reportedVolume: 100, audioPlayer });

  reapplyVolumeWhenPlaying(queue, 70);
  reapplyVolumeWhenPlaying(queue, 70);
  assert.equal(audioPlayer.listenerCount(), 1, 'solo un listener pendiente por AudioPlayer');
  assert.deepEqual(transformerCalls, [], 'no aplica hasta reproducir');

  audioPlayer.emit('stateChange', { status: 'buffering' }, { status: 'playing' });
  assert.deepEqual(transformerCalls, [70]);
  assert.equal(audioPlayer.listenerCount(), 0, 'el listener se retira tras aplicarse');

  audioPlayer.emit('stateChange', { status: 'playing' }, { status: 'idle' });
  assert.deepEqual(transformerCalls, [70], 'no reaplica en transiciones que no son playing');
});

test('reapplyVolumeWhenPlaying no registra listeners si ya está reproduciendo', () => {
  const audioPlayer = fakeAudioPlayer('playing');
  const { queue } = fakeVolumeQueue({ audioPlayer });

  reapplyVolumeWhenPlaying(queue, 70);
  assert.equal(audioPlayer.listenerCount(), 0);
  assert.equal(getDesiredVolume(queue), 70);
});
