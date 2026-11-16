import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { Client } from 'discord.js';
import {
  ANSI_COLORS,
  STARTUP_BOOT_LINES,
  formatLogTime,
  getSystemMetrics,
  logRow,
  paint,
  printBootHeader,
  printStartupBanner,
  serializeError,
  summarizePlayerError,
  traceEvent,
  type LogColor,
} from '../../src/utils/logger.js';

const fakeClient = { ws: { ping: 42 } } as unknown as Client;

function captureLogs(fn: () => void): string[] {
  const originalLog = console.log;
  const lines: string[] = [];
  console.log = ((...args: unknown[]) => {
    lines.push(args.map((a) => String(a)).join(' '));
  }) as typeof console.log;
  try {
    fn();
  } finally {
    console.log = originalLog;
  }
  return lines;
}

const stripAnsi = (text: string) => text.replace(/\u001b\[[0-9;]*m/g, '');

function withTemporaryWorkingDirectory<T>(run: (directory: string) => T): T {
  const originalDirectory = process.cwd();
  const directory = mkdtempSync(join(tmpdir(), 'cubitosmusic-logger-'));
  try {
    process.chdir(directory);
    return run(directory);
  } finally {
    process.chdir(originalDirectory);
    rmSync(directory, { recursive: true, force: true });
  }
}

function withTraceEnvironment<T>(liveTrace: string | undefined, logToFile: string | undefined, run: () => T): T {
  const previousLiveTrace = process.env.LIVE_TRACE;
  const previousLogToFile = process.env.LOG_TO_FILE;
  if (liveTrace === undefined) delete process.env.LIVE_TRACE;
  else process.env.LIVE_TRACE = liveTrace;
  if (logToFile === undefined) delete process.env.LOG_TO_FILE;
  else process.env.LOG_TO_FILE = logToFile;
  try {
    return run();
  } finally {
    if (previousLiveTrace === undefined) delete process.env.LIVE_TRACE;
    else process.env.LIVE_TRACE = previousLiveTrace;
    if (previousLogToFile === undefined) delete process.env.LOG_TO_FILE;
    else process.env.LOG_TO_FILE = previousLogToFile;
  }
}

test('paint aplica el código de color ANSI con reset al final', () => {
  const colored = paint('red', 'ERROR');
  assert.ok(colored.includes('\u001b[31m'));
  assert.ok(colored.endsWith('\u001b[0m'));
});

test('printBootHeader imprime el mensaje principal y una pareja determinista', () => {
  const lines = captureLogs(() => printBootHeader(() => 0.5));

  assert.equal(lines.length, 3);
  assert.equal(stripAnsi(lines[0]), '⚡ Larga Vida a Cubitos.');
  assert.equal(stripAnsi(lines[1]), `   ↳ ${STARTUP_BOOT_LINES[1][0]}`);
  assert.equal(stripAnsi(lines[2]), `   ↳ ${STARTUP_BOOT_LINES[1][1]}`);
  assert.ok(lines[0].includes(ANSI_COLORS.cyan));
  assert.ok(lines[0].includes(ANSI_COLORS.bold));
  assert.ok(lines[1].includes(ANSI_COLORS.gray));
  assert.ok(lines[2].includes(ANSI_COLORS.gray));
});

test('formatLogTime devuelve HH:MM:SS en zona America/Santiago', () => {
  const formatted = formatLogTime(new Date('2026-11-12T14:34:59-03:00'));
  assert.match(formatted, /^\d{2}:\d{2}:\d{2}$/);
});

test('getSystemMetrics incluye RAM y ping del WebSocket', () => {
  const metrics = getSystemMetrics(fakeClient);
  assert.match(metrics, /^RAM \d+(\.\d+)?MB • \d+ms$/);
});

test('getSystemMetrics funciona sin cliente', () => {
  const metrics = getSystemMetrics();
  assert.ok(metrics.startsWith('RAM '));
});

test('logRow imprime una fila alineada con badge, canal, detalle y métricas', () => {
  const lines = captureLogs(() => {
    logRow({
      badge: '▶ PLAY',
      color: 'green',
      channel: 'musica-general',
      detail: 'Daft Punk - One More Time (3:45)',
      metrics: 'Carga: 2.1s • #1 • RAM 84.3MB • 42ms',
    });
  });

  assert.equal(lines.length, 1);
  const plain = stripAnsi(lines[0]);
  assert.match(plain, /\[▶ PLAY\]/);
  assert.match(plain, /#musica-general/);
  assert.match(plain, /Daft Punk - One More Time \(3:45\)/);
  assert.ok(plain.startsWith('  '), 'la fila debe empezar con 2 espacios');
  assert.ok(plain.length < 160, `fila demasiado larga: ${plain}`);
});

test('logRow rellena DETALLES a 52 caracteres y alinea MÉTRICAS', () => {
  const lines = captureLogs(() => {
    logRow({ badge: 'X', color: 'gray', channel: 'c', detail: 'uno', metrics: 'M1' });
    logRow({ badge: 'ERR AUDIO', color: 'red', channel: 'canal-largo-123', detail: 'dos', metrics: 'M2' });
  });

  const [first, second] = lines.map(stripAnsi);

  // DETALLES padded a 52 (3 + 49 espacios) antes de MÉTRICAS.
  const detailStart = first.indexOf('uno');
  assert.equal(first.slice(detailStart, detailStart + 52), `uno${' '.repeat(49)}`);

  // La columna MÉTRICAS arranca en el mismo offset sin importar el badge/canal.
  assert.equal(first.indexOf('M1'), second.indexOf('M2'));
});

test('logRow trunca el detalle a 50 caracteres con elipsis', () => {
  const lines = captureLogs(() => {
    logRow({ badge: 'X', color: 'gray', detail: 'a'.repeat(80), metrics: '' });
  });
  const plain = stripAnsi(lines[0]);
  assert.ok(plain.includes('…'));
  assert.ok(!plain.includes('a'.repeat(80)));
  assert.ok(plain.includes(`${'a'.repeat(50)}…`));
});

test('logRow aplana saltos de línea y tabulaciones en una sola fila', () => {
  const lines = captureLogs(() => {
    logRow({
      badge: 'ERROR\nX',
      color: 'red',
      channel: 'musica\n#2',
      detail: 'yt-dlp\nWARNING:\tfallo\nsegunda línea',
      metrics: 'RAM 84MB\nfallback',
    });
  });

  assert.equal(lines.length, 1);
  const plain = stripAnsi(lines[0]);
  assert.equal(plain.includes('\n'), false);
  assert.equal(plain.includes('\t'), false);
  assert.match(plain, /\[ERROR X\]/);
  assert.match(plain, /#musica #2/);
  assert.match(plain, /yt-dlp WARNING: fallo segunda línea/);
  assert.match(plain, /RAM 84MB fallback/);
});

test('summarizePlayerError elimina prefijos de yt-dlp y colapsa líneas', () => {
  assert.equal(
    summarizePlayerError('yt-dlp exited code=1 WARNING: [youtube] xyz: Video unavailable'),
    'Video unavailable',
  );
  assert.equal(
    summarizePlayerError('ERROR: [youtube] abc_123: Sign in to confirm your age\nWARNING: detalle'),
    'Sign in to confirm your age detalle',
  );
});

test('printStartupBanner muestra el logo multicolor, conserva la telemetría y alinea el recuadro', () => {
  const lines = captureLogs(() => {
    printStartupBanner({
      botTag: 'CubitoMusic#1234',
      guildName: 'Servidor de prueba',
      spotifyEnabled: true,
      extractorCount: 4,
      client: { ws: { ping: -1 } } as unknown as Client,
    });
  });

  const signatureIndex = lines.findIndex((line) => stripAnsi(line).includes('Cubitos Dev'));
  assert.ok(signatureIndex >= 0, 'no se encontró la firma Cubitos Dev');
  assert.match(lines[0], /\u001b\[36m\u001b\[1m/);
  assert.match(lines[0], /\u001b\[35m\u001b\[1m/);
  assert.match(lines[signatureIndex], /\u001b\[90m/);

  // Localiza la caja aunque el banner emita un salto de línea inicial en TTY.
  const boxStart = lines.findIndex((line) => stripAnsi(line).startsWith('╭'));
  assert.ok(boxStart >= 0, 'no se encontró el borde superior del banner');
  assert.ok(signatureIndex < boxStart, 'la firma debe aparecer antes del recuadro');

  const logoLines = [
    '   ______      __    _ __            __  ___           _',
    '  / ____/_  __/ /_  (_) /_____  ____/  |/  /_  _______(_)____',
    ' / /   / / / / __ \\/ / __/ __ \\/ ___/ /|_/ / / / / ___/ / ___/',
    '/ /___/ /_/ / /_/ / / /_/ /_/ (__  ) /  / / /_/ (__  ) / /__',
    '\\____/\\__,_/_.___/_/\\__/\\____/____/_/  /_/\\__,_/____/_/\\___/',
  ];
  assert.deepEqual(lines.slice(0, 5).map(stripAnsi), logoLines);

  // Borde superior + 6 filas + borde inferior.
  const boxLines = lines.slice(boxStart, boxStart + 8);
  const widths = new Set(boxLines.map((line) => stripAnsi(line).length));
  assert.equal(widths.size, 1, `anchos inconsistentes: ${[...widths].join(', ')}`);
  assert.ok(stripAnsi(boxLines[0]).endsWith('╮'));
  assert.ok(stripAnsi(boxLines[7]).endsWith('╯'));
  assert.match(lines[boxStart + 1], /\u001b\[36m\u001b\[1m/);
  assert.match(lines[boxStart + 1], /\u001b\[35m\u001b\[1m/);

  const plainBox = boxLines.map(stripAnsi).join('\n');
  assert.match(plainBox, /Cubitos Music v1\.1\.0/);
  assert.match(plainBox, /Bot: CubitoMusic#1234/);
  assert.match(plainBox, /Servidor: Servidor de prueba/);
  assert.match(plainBox, new RegExp(`Node: ${process.version.replaceAll('.', '\\.')}`));
  assert.match(plainBox, /Spotify: activado/);
  assert.match(plainBox, /Ping: calculando\.\.\. • RAM: \d+(\.\d+)?MB • Extractores: 4/);

  // Separador y encabezado comparten ancho.
  assert.equal(stripAnsi(lines[boxStart + 8]).length, stripAnsi(lines[boxStart + 9]).length);
  assert.match(stripAnsi(lines[boxStart + 9]), /HORA\s+EVENTO\s+CANAL\s+DETALLES\s+MÉTRICAS/);
});

test('ANSI_COLORS expone los códigos base', () => {
  assert.equal(ANSI_COLORS.reset, '\u001b[0m');
  assert.equal(ANSI_COLORS.dim, '\u001b[2m');
  assert.equal(ANSI_COLORS.bold, '\u001b[1m');
  const _unused: LogColor = 'green';
  assert.equal(typeof _unused, 'string');
});

test('serializeError incluye campos de Error y serializa cause recursivamente', () => {
  const cause = Object.assign(new TypeError('causa original'), { code: 'E_ORIGINAL' });
  const error = Object.assign(new Error('fallo principal', { cause }), { code: 42 });
  const serialized = serializeError(error);

  assert.deepEqual(Object.keys(serialized), ['name', 'message', 'code', 'stack', 'cause']);
  assert.equal(serialized.name, 'Error');
  assert.equal(serialized.message, 'fallo principal');
  assert.equal(serialized.code, 42);
  assert.match(serialized.stack ?? '', /fallo principal/);
  assert.deepEqual(serialized.cause, {
    name: 'TypeError',
    message: 'causa original',
    code: 'E_ORIGINAL',
    stack: cause.stack,
    cause: null,
  });
});

test('serializeError convierte valores que no son instancias Error', () => {
  assert.deepEqual(serializeError('fallo'), {
    name: 'Error',
    message: 'fallo',
    code: null,
    stack: null,
    cause: null,
  });
});

test('traceEvent no crea archivos con LIVE_TRACE y LOG_TO_FILE apagados', () => {
  withTemporaryWorkingDirectory((directory) => {
    withTraceEnvironment('false', 'false', () => {
      traceEvent('debug', 'test_disabled', { value: 1 });
    });
    assert.equal(existsSync(join(directory, 'logs', 'live-trace.jsonl')), false);
  });
});

test('traceEvent agrega JSON válido a live-trace.jsonl cuando LIVE_TRACE está activo', () => {
  withTemporaryWorkingDirectory((directory) => {
    withTraceEnvironment('true', 'false', () => {
      traceEvent('timing', 'test_enabled', { deferMs: 12.5 });
    });

    const tracePath = join(directory, 'logs', 'live-trace.jsonl');
    const lines = readFileSync(tracePath, 'utf8').trim().split('\n');
    assert.equal(lines.length, 1);
    assert.deepEqual(JSON.parse(lines[0]), {
      timestamp: JSON.parse(lines[0]).timestamp,
      category: 'timing',
      event: 'test_enabled',
      deferMs: 12.5,
    });
    assert.ok(Number.isFinite(Date.parse(JSON.parse(lines[0]).timestamp)));
  });
});
