import { mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Client } from 'discord.js';

/**
 * Interfaz de terminal limpia para el bot (sin dependencias externas).
 * Usa códigos ANSI nativos. Solo redibuja (console.clear) cuando hay TTY.
 */

export const ANSI_COLORS = {
  reset: '\u001b[0m',
  dim: '\u001b[2m',
  bold: '\u001b[1m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  blue: '\u001b[34m',
  magenta: '\u001b[35m',
  cyan: '\u001b[36m',
  red: '\u001b[31m',
  gray: '\u001b[90m',
} as const;

export type LogColor = keyof typeof ANSI_COLORS;

export function paint(color: LogColor, text: string): string {
  const codes: Record<LogColor, string> = {
    reset: ANSI_COLORS.reset,
    dim: ANSI_COLORS.dim,
    bold: ANSI_COLORS.bold,
    green: ANSI_COLORS.green,
    yellow: ANSI_COLORS.yellow,
    blue: ANSI_COLORS.blue,
    magenta: ANSI_COLORS.magenta,
    cyan: ANSI_COLORS.cyan,
    red: ANSI_COLORS.red,
    gray: ANSI_COLORS.gray,
  };
  return `${codes[color]}${text}${ANSI_COLORS.reset}`;
}

function pad(text: string, width: number): string {
  const value = String(text);
  return value.length >= width ? value : value + ' '.repeat(width - value.length);
}

const logTimeFormatter = new Intl.DateTimeFormat('es-CL', {
  timeZone: 'America/Santiago',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** Hora actual en formato 24h (zona America/Santiago), tipo `HH:MM`. */
export function formatLogTime(date: Date = new Date): string {
  const parts = logTimeFormatter.formatToParts(date);
  const hour = Math.min(Number(parts.find((p) => p.type === 'hour')?.value ?? 0), 23);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Métricas en tiempo real: uso de RAM (RSS) y ping del WebSocket. */
export function getSystemMetrics(client?: Client): string {
  const ramMb = Math.round((process.memoryUsage().rss / 1024 / 1024) * 10) / 10;
  const ping = client?.ws?.ping ?? 0;
  const pingMs = Number.isFinite(ping) ? Math.round(ping) : 0;
  return `RAM ${ramMb}MB • ${pingMs}ms`;
}

export interface StartupBannerInfo {
  botTag: string;
  guildName: string;
  spotifyEnabled: boolean;
  extractorCount: number;
  client: Client;
}

/** Banner de arranque con recuadro Unicode + encabezado de tabla de logs. */
export function printStartupBanner(info: StartupBannerInfo): void {
  if (process.stdout.isTTY) {
    console.clear();
  }

  const width = 48;
  const line = '─'.repeat(width);
  const row = (text: string) => `│ ${pad(text, width - 2)} │`;

  console.log(`╭${line}╮`);
  console.log(row('CUBITOS MUSIC v1.1.0'));
  console.log(row(`Bot: ${info.botTag}`));
  console.log(row(`Servidor: ${info.guildName}`));
  console.log(row(`Node: ${process.version}`));
  console.log(row(`Spotify: ${info.spotifyEnabled ? 'activado' : 'sin credenciales'}`));
  console.log(row(`Ping: ${Math.round(info.client?.ws?.ping ?? 0)}ms • RAM: ${Math.round(process.memoryUsage().rss / 1024 / 1024 * 10) / 10}MB • Extractores: ${info.extractorCount}`));
  console.log(`╰${line}╯`);
  console.log(line);
  console.log('HORA       EVENTO          CANAL        DETALLES                          MÉTRICAS');
  console.log(line);
}

export interface LogRowOptions {
  badge: string;
  color: LogColor;
  channel?: string | null;
  detail: string;
  metrics?: string;
  rawJson?: Record<string, unknown>;
}

/** Imprime una fila de la tabla de logs con columnas alineadas y color por badge. */
export function logRow(opts: LogRowOptions): void {
  const time = formatLogTime();
  const badgeText = `[${opts.badge}]`;
  const channelText = opts.channel ? `#${opts.channel}` : '—';
  const detail = opts.detail.length > 50 ? `${opts.detail.slice(0, 50)}…` : opts.detail;

  const line =
    `${pad(time, 5)}  ${pad(badgeText, 10)}  ${pad(channelText, 16)}  ${pad(detail, 50)}  ${opts.metrics ?? ''}`;
  console.log(paint(opts.color, line));

  if (process.env.LOG_TO_FILE === 'true' && opts.rawJson) {
    const logDir = join(process.cwd(), 'logs');
    mkdirSync(logDir, { recursive: true });
    appendFileSync(
      join(logDir, 'playback.jsonl'),
      `${JSON.stringify({ timestamp: new Date().toISOString(), ...opts.rawJson })}\n`,
    );
  }
}
