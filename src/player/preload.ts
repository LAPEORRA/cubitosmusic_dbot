/**
 * Precarga de audio en segundo plano.
 *
 * Problema que resuelve: desde una IP de GCP, el primer byte de `yt-dlp` tarda
 * 17-90 s (rate-limit de YouTube + challenge `nsig` en 0.25 vCPU). Una vez
 * arranca, el flujo va a ~1.3 MB/s, así que el coste es **solo el arranque**.
 *
 * Solución: mientras suena la pista N, se descarga la N+1 a disco. Cuando llega
 * su turno, `onBeforeCreateStream` devuelve un `fs.createReadStream` local y no
 * hay que esperar al extractor.
 *
 * Reglas de recursos (VM de 964 MiB y 30 GB de disco):
 * - **Una sola descarga a la vez**: las tareas se encadenan (`chain`).
 * - **Solo se precarga la pista siguiente**: `syncPreload` fija el conjunto
 *   deseado por guild como {pista actual, siguiente}.
 * - **Limpieza inmediata**: cualquier archivo fuera de ese conjunto se borra en
 *   el mismo `syncPreload`; además `dropPreload` lo borra al terminar o saltar
 *   la pista, y `forgetGuild` al vaciar/cerrar la cola.
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import type { Readable } from 'node:stream';
import type { GuildQueue, Track } from 'discord-player';
import { logRow, traceEvent } from '../utils/logger.js';

const MAX_AGE_MS = 30 * 60_000;
const AUDIO_EXT = '.webm';

type SpawnChildLike = {
  pid?: number;
  kill: (signal?: NodeJS.Signals | number) => boolean;
  on: (event: string, listener: (...args: any[]) => void) => unknown;
};

type Slot = {
  path: string;
  state: 'downloading' | 'ready';
  child?: SpawnChildLike;
};

export interface PreloadManagerOptions {
  preloadDir?: string;
  enabled?: boolean;
  maxAgeMs?: number;
  cookiesPath?: string;
  now?: () => number;
  spawnFn?: (cmd: string, args: string[], opts: { stdio: 'ignore' }) => SpawnChildLike;
  openStreamFn?: (path: string) => Readable;
}

/** `queue.tracks` es un `Queue` interno: probamos las APIs habituales. */
function firstQueued(queue: any): Track | null {
  const tracks = queue?.tracks;
  if (!tracks) return null;
  try {
    if (typeof tracks.at === 'function') return tracks.at(0) ?? null;
    if (typeof tracks.first === 'function') return tracks.first() ?? null;
    return [...tracks][0] ?? null;
  } catch {
    return null;
  }
}

export function createPreloadManager(options: PreloadManagerOptions = {}) {
  const preloadDir = options.preloadDir ?? process.env.PRELOAD_DIR ?? '/app/preload';
  const enabled = options.enabled ?? (process.env.PRELOAD_AUDIO ?? 'true').toLowerCase() !== 'false';
  const maxAgeMs = options.maxAgeMs ?? MAX_AGE_MS;
  const now = options.now ?? (() => Date.now());
  const spawnFn = options.spawnFn ?? ((cmd, args, opts) => spawn(cmd, args, opts));
  const openStreamFn = options.openStreamFn ?? ((path) => createReadStream(path));

  const slots = new Map<string, Slot>();
  /** Claves que cada guild considera necesarias ahora mismo. */
  const desiredByGuild = new Map<string, Set<string>>();
  /** Cola global de descargas: garantiza una sola a la vez. */
  let chain: Promise<void> = Promise.resolve();
  let sweepTimer: NodeJS.Timeout | null = null;

  function ensureDir(): void {
    try {
      mkdirSync(preloadDir, { recursive: true });
    } catch {
      /* sin permisos: la precarga simplemente no se usará */
    }
  }

  function safeUnlink(path: string): void {
    try {
      unlinkSync(path);
    } catch {
      /* ya no existe */
    }
  }

  function keyFor(track: Track): string {
    const raw = String((track as any)?.url ?? track?.id ?? '');
    return createHash('sha1').update(raw).digest('hex').slice(0, 16);
  }

  function pathFor(key: string): string {
    return join(preloadDir, key + AUDIO_EXT);
  }

  function isDesired(key: string): boolean {
    for (const set of desiredByGuild.values()) {
      if (set.has(key)) return true;
    }
    return false;
  }

  /** Borra todo archivo que ningún guild necesite y los que superen MAX_AGE. */
  function sweep(): void {
    let files: string[] = [];
    try {
      files = readdirSync(preloadDir);
    } catch {
      return;
    }

    const currentTime = now();
    for (const file of files) {
      const key = file.replace(/\.[^.]+$/, '');
      const full = join(preloadDir, file);
      const slot = slots.get(key);

      if (!isDesired(key)) {
        // Descarga en curso que ya nadie quiere: se cancela y se borra.
        slot?.child?.kill('SIGTERM');
        slots.delete(key);
        safeUnlink(full);
        continue;
      }

      try {
        if (currentTime - statSync(full).mtimeMs > maxAgeMs) {
          slot?.child?.kill('SIGTERM');
          slots.delete(key);
          safeUnlink(full);
        }
      } catch {
        /* carrera con el borrado */
      }
    }
  }

  function buildArgs(track: Track, path: string): string[] {
    const args = [
      '--no-playlist',
      '--no-progress',
      '--no-part',
      '--no-keep-fragments',
      '--concurrent-fragments',
      '1',
      '--js-runtimes',
      'node',
      '--retries',
      '3',
      '--fragment-retries',
      '3',
      '-f',
      'bestaudio[acodec=opus]/bestaudio/best',
      '-o',
      path,
    ];

    const cookies = options.cookiesPath ?? process.env.YOUTUBE_COOKIES;
    if (cookies && existsSync(cookies)) args.push('--cookies', cookies);

    args.push(String((track as any).url));
    return args;
  }

  function startDownload(track: Track, key: string): Promise<void> {
    const path = pathFor(key);
    const slot: Slot = { path, state: 'downloading' };
    slots.set(key, slot);

    return new Promise<void>((resolve) => {
      let child: SpawnChildLike;
      try {
        child = spawnFn('yt-dlp', buildArgs(track, path), { stdio: 'ignore' });
      } catch (error: any) {
        slots.delete(key);
        traceEvent('error', 'preload_spawn_failed', { error: String(error?.message ?? error) });
        return resolve();
      }

      slot.child = child;

      // Baja prioridad: la reproducción manda sobre la descarga.
      if (typeof child.pid === 'number') {
        try {
          os.setPriority(child.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
        } catch {
          /* no crítico */
        }
      }

      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        slot.child = undefined;
        if (ok && existsSync(path)) {
          slot.state = 'ready';
          traceEvent('timing', 'preload_ready', { title: track.title, key });
        } else {
          slots.delete(key);
          safeUnlink(path);
          traceEvent('error', 'preload_failed', { title: track.title, key });
        }
        resolve();
      };

      child.on('error', () => finish(false));
      child.on('exit', (code) => finish(code === 0));
    });
  }

  function enqueue(track: Track, key: string): void {
    if (slots.has(key)) return;

    chain = chain
      .then(async () => {
        // Pudo dejar de interesar mientras esperaba su turno.
        if (!isDesired(key) || slots.has(key)) return;
        await startDownload(track, key);
      })
      .catch(() => {
        /* la cadena nunca debe romperse */
      });
  }

  /**
   * Recalcula el conjunto deseado de un guild, limpia lo que sobra y encola la
   * pista siguiente. Idempotente: se puede llamar en cada evento sin coste.
   */
  function syncPreload(queue: GuildQueue): void {
    if (!enabled || !queue?.guild?.id) return;
    ensureDir();

    const desired = new Set<string>();
    const current = queue.currentTrack;
    if (current) desired.add(keyFor(current));

    const next = firstQueued(queue);
    if (next) desired.add(keyFor(next));

    desiredByGuild.set(queue.guild.id, desired);
    sweep();

    if (current && next) enqueue(next, keyFor(next));
  }

  /** Al terminar o saltar una pista: fuera su archivo, sin esperar a la siguiente. */
  function dropPreload(track: Track | null | undefined): void {
    if (!enabled || !track) return;
    const key = keyFor(track);
    slots.get(key)?.child?.kill('SIGTERM');
    slots.delete(key);
    safeUnlink(pathFor(key));
  }

  /** Al vaciar o cerrar la cola: ese guild ya no necesita nada. */
  function forgetGuild(guildId: string): void {
    if (!enabled) return;
    desiredByGuild.delete(guildId);
    sweep();
  }

  /**
   * Hook global de discord-player. Devuelve el stream local si la pista estaba
   * precargada; `null` hace que siga el camino normal del extractor.
   */
  function openPreloaded(track: Track): Readable | null {
    if (!enabled || !track) return null;

    const key = keyFor(track);
    const slot = slots.get(key);
    if (!slot || slot.state !== 'ready') return null;
    if (!existsSync(slot.path)) {
      slots.delete(key);
      return null;
    }

    traceEvent('timing', 'preload_hit', { title: track.title, key });
    return openStreamFn(slot.path);
  }

  /** Arranque: deja el directorio limpio y programa un barrido de seguridad. */
  function initPreload(): void {
    if (!enabled) return;
    ensureDir();
    sweep();

    if (sweepTimer) clearInterval(sweepTimer);
    sweepTimer = setInterval(sweep, 5 * 60_000);
    sweepTimer.unref?.();

    logRow({
      badge: 'PRELOAD',
      color: 'blue',
      channel: null,
      detail: `Precarga activa en ${preloadDir}`,
    });
  }

  function stopSweep(): void {
    if (sweepTimer) {
      clearInterval(sweepTimer);
      sweepTimer = null;
    }
  }

  return {
    syncPreload,
    dropPreload,
    forgetGuild,
    openPreloaded,
    initPreload,
    stopSweep,
    keyFor,
    pathFor,
    _waitChain: () => chain,
  };
}

let defaultManager: ReturnType<typeof createPreloadManager> | null = null;
function getDefaultManager() {
  return (defaultManager ??= createPreloadManager());
}

export const syncPreload = (queue: GuildQueue) => getDefaultManager().syncPreload(queue);
export const dropPreload = (track: Track | null | undefined) => getDefaultManager().dropPreload(track);
export const forgetGuild = (guildId: string) => getDefaultManager().forgetGuild(guildId);
export const openPreloaded = (track: Track) => getDefaultManager().openPreloaded(track);
export const initPreload = () => getDefaultManager().initPreload();
