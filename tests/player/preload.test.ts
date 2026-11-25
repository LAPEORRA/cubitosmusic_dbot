import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import { Readable } from 'node:stream';
import { createPreloadManager } from '../../src/player/preload.js';

class FakeChild extends EventEmitter {
  pid = 999999;
  killedSignals: Array<string | number | undefined> = [];
  kill(signal?: NodeJS.Signals | number): boolean {
    this.killedSignals.push(signal);
    this.emit('exit', 1);
    return true;
  }
}

function makeTrack(id: string) {
  return {
    id,
    title: `Track ${id}`,
    url: `https://www.youtube.com/watch?v=${id}`,
  } as any;
}

function makeQueue(guildId: string, current: any, queued: any[]) {
  return {
    guild: { id: guildId },
    currentTrack: current,
    tracks: {
      at: (idx: number) => queued[idx] ?? null,
    },
  } as any;
}

test('createPreloadManager descarga como máximo 1 pista a la vez y solo la siguiente', async () => {
  const dir = mkdtempSync(join(os.tmpdir(), 'cubitos-preload-'));
  try {
    let activeDownloads = 0;
    let maxConcurrent = 0;
    const spawnedUrls: string[] = [];
    const children: FakeChild[] = [];

    const manager = createPreloadManager({
      preloadDir: dir,
      enabled: true,
      spawnFn: (_cmd, args) => {
        const child = new FakeChild();
        children.push(child);
        const outIndex = args.indexOf('-o');
        const outPath = outIndex >= 0 ? args[outIndex + 1] : '';
        const url = args[args.length - 1];
        spawnedUrls.push(url);

        activeDownloads += 1;
        maxConcurrent = Math.max(maxConcurrent, activeDownloads);

        queueMicrotask(() => {
          writeFileSync(outPath, 'audio-bytes');
          activeDownloads -= 1;
          child.emit('exit', 0);
        });
        return child;
      },
    });

    const t1 = makeTrack('aaa');
    const t2 = makeTrack('bbb');
    const t3 = makeTrack('ccc');

    manager.syncPreload(makeQueue('g1', t1, [t2, t3]));
    await manager._waitChain();

    assert.equal(maxConcurrent, 1);
    assert.deepEqual(spawnedUrls, [t2.url]);

    const streamHit = manager.openPreloaded(t2);
    assert.ok(streamHit instanceof Readable);
    await new Promise<void>((resolve) => {
      streamHit.once('close', () => resolve());
      streamHit.destroy();
    });

    assert.equal(manager.openPreloaded(t3), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('dropPreload y forgetGuild limpian archivos y cancelan descargas en curso', async () => {
  const dir = mkdtempSync(join(os.tmpdir(), 'cubitos-preload-clean-'));
  try {
    const children: FakeChild[] = [];
    const manager = createPreloadManager({
      preloadDir: dir,
      enabled: true,
      spawnFn: (_cmd, args) => {
        const child = new FakeChild();
        children.push(child);
        const outIndex = args.indexOf('-o');
        const outPath = outIndex >= 0 ? args[outIndex + 1] : '';
        writeFileSync(outPath, 'partial');
        return child;
      },
    });

    const t1 = makeTrack('one');
    const t2 = makeTrack('two');

    // t2 queda descargando
    manager.syncPreload(makeQueue('g1', t1, [t2]));
    await new Promise((r) => setTimeout(r, 15));

    const t2Path = manager.pathFor(manager.keyFor(t2));
    assert.equal(existsSync(t2Path), true);
    assert.equal(children.length, 1);

    // dropPreload cancela el proceso y elimina el archivo inmediatamente
    manager.dropPreload(t2);
    assert.deepEqual(children[0].killedSignals, ['SIGTERM']);
    assert.equal(existsSync(t2Path), false);

    // Ahora probamos forgetGuild al vaciar/cerrar cola con un archivo listo
    const t3 = makeTrack('three');
    const manager2 = createPreloadManager({
      preloadDir: dir,
      enabled: true,
      spawnFn: (_cmd, args) => {
        const child = new FakeChild();
        const outIndex = args.indexOf('-o');
        const outPath = outIndex >= 0 ? args[outIndex + 1] : '';
        queueMicrotask(() => {
          writeFileSync(outPath, 'complete');
          child.emit('exit', 0);
        });
        return child;
      },
    });

    manager2.syncPreload(makeQueue('g2', t1, [t3]));
    await manager2._waitChain();

    const t3Path = manager2.pathFor(manager2.keyFor(t3));
    assert.equal(existsSync(t3Path), true);

    manager2.forgetGuild('g2');
    assert.equal(existsSync(t3Path), false);
    assert.equal(manager2.openPreloaded(t3), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('initPreload limpia archivos huérfanos previos y respeta enabled=false', () => {
  const dir = mkdtempSync(join(os.tmpdir(), 'cubitos-preload-init-'));
  try {
    const orphan = join(dir, 'orphan123.webm');
    writeFileSync(orphan, 'stale');
    assert.equal(existsSync(orphan), true);

    const manager = createPreloadManager({
      preloadDir: dir,
      enabled: true,
    });
    manager.initPreload();
    manager.stopSweep();

    assert.equal(existsSync(orphan), false);

    const disabled = createPreloadManager({
      preloadDir: dir,
      enabled: false,
      spawnFn: () => {
        throw new Error('no debe ejecutarse');
      },
    });
    const t1 = makeTrack('x1');
    const t2 = makeTrack('x2');
    disabled.syncPreload(makeQueue('g1', t1, [t2]));
    assert.equal(disabled.openPreloaded(t2), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
