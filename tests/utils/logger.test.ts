import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Client } from 'discord.js';
import {
  ANSI_COLORS,
  formatLogTime,
  getSystemMetrics,
  logRow,
  paint,
  printStartupBanner,
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

test('paint aplica el código de color ANSI con reset al final', () => {
  const colored = paint('red', 'ERROR');
  assert.ok(colored.includes('\u001b[31m'));
  assert.ok(colored.endsWith('\u001b[0m'));
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

test('printStartupBanner mantiene el borde derecho alineado con la línea superior', () => {
  const lines = captureLogs(() => {
    printStartupBanner({
      botTag: 'CubitoMusic#1234',
      guildName: 'Servidor de prueba',
      spotifyEnabled: true,
      extractorCount: 4,
      client: { ws: { ping: -1 } } as unknown as Client,
    });
  });

  // Localiza la caja aunque el banner emita un salto de línea inicial en TTY.
  const boxStart = lines.findIndex((line) => stripAnsi(line).startsWith('╭'));
  assert.ok(boxStart >= 0, 'no se encontró el borde superior del banner');

  // Borde superior + 6 filas + borde inferior.
  const boxLines = lines.slice(boxStart, boxStart + 8);
  const widths = new Set(boxLines.map((line) => stripAnsi(line).length));
  assert.equal(widths.size, 1, `anchos inconsistentes: ${[...widths].join(', ')}`);
  assert.ok(stripAnsi(boxLines[0]).endsWith('╮'));
  assert.ok(stripAnsi(boxLines[7]).endsWith('╯'));

  // Separador y encabezado comparten ancho.
  assert.equal(stripAnsi(lines[boxStart + 8]).length, stripAnsi(lines[boxStart + 9]).length);
});

test('ANSI_COLORS expone los códigos base', () => {
  assert.equal(ANSI_COLORS.reset, '\u001b[0m');
  assert.equal(ANSI_COLORS.dim, '\u001b[2m');
  assert.equal(ANSI_COLORS.bold, '\u001b[1m');
  const _unused: LogColor = 'green';
  assert.equal(typeof _unused, 'string');
});
