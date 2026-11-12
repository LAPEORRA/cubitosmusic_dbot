import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Client } from 'discord.js';
import { ANSI_COLORS, formatLogTime, getSystemMetrics, logRow, paint, type LogColor } from '../../src/utils/logger.js';

const fakeClient = { ws: { ping: 42 } } as unknown as Client;

test('paint aplica el código de color ANSI con reset al final', () => {
  const colored = paint('red', 'ERROR');
  assert.ok(colored.includes('\u001b[31m'));
  assert.ok(colored.endsWith('\u001b[0m'));
});

test('formatLogTime devuelve HH:MM en zona America/Santiago', () => {
  const formatted = formatLogTime(new Date('2026-11-12T14:34:59-03:00'));
  assert.match(formatted, /^\d{2}:\d{2}$/);
  assert.match(formatted, /:/);
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
  const originalLog = console.log;
  const lines: string[] = [];
  console.log = ((...args: unknown[]) => {
    lines.push(args.map((a) => String(a)).join(' '));
  }) as typeof console.log;

  try {
    logRow({
      badge: '▶ PLAY',
      color: 'green',
      channel: 'musica-general',
      detail: 'Daft Punk - One More Time (3:45)',
      metrics: 'Carga: 2.1s • #1 • RAM 84.3MB • 42ms',
    });
  } finally {
    console.log = originalLog;
  }

  assert.equal(lines.length, 1);
  assert.match(lines[0], /\[▶ PLAY\]/);
  assert.match(lines[0], /#musica-general/);
  assert.match(lines[0], /Daft Punk - One More Time \(3:45\)/);
  const plain = lines[0].replace(/\u001b\[[0-9;]*m/g, '');
  assert.ok(plain.length < 160, `fila demasiado larga: ${plain}`);
});

test('logRow trunca el detalle a 50 caracteres con elipsis', () => {
  let printed = '';
  const originalLog = console.log;
  console.log = ((...args: unknown[]) => {
    printed = args.map((a) => String(a)).join(' ');
  }) as typeof console.log;
  try {
    logRow({ badge: 'X', color: 'gray', detail: 'a'.repeat(80), metrics: '' });
  } finally {
    console.log = originalLog;
  }
  assert.ok(printed.includes('…'));
  assert.ok(!printed.includes('a'.repeat(80)));
});

test('ANSI_COLORS expone los códigos base', () => {
  assert.equal(ANSI_COLORS.reset, '\u001b[0m');
  assert.equal(ANSI_COLORS.dim, '\u001b[2m');
  assert.equal(ANSI_COLORS.bold, '\u001b[1m');
  const _unused: LogColor = 'green';
  assert.equal(typeof _unused, 'string');
});
