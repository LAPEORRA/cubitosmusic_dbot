import { mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Client } from 'discord.js';

/**
 * Interfaz de terminal limpia para el bot (sin dependencias externas).
 * Usa códigos ANSI nativos. Solo redibuja (salto de línea) cuando hay TTY.
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
  second: '2-digit',
  hour12: false,
});

/** Hora actual en formato 24h (zona America/Santiago), tipo `HH:MM:SS`. */
export function formatLogTime(date: Date = new Date): string {
  const parts = logTimeFormatter.formatToParts(date);
  const hour = Math.min(Number(parts.find((p) => p.type === 'hour')?.value ?? 0), 23);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  const second = Number(parts.find((p) => p.type === 'second')?.value ?? 0);
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  const ss = String(second).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

/** Métricas en tiempo real: uso de RAM (RSS) y ping del WebSocket. */
export function getSystemMetrics(client?: Client): string {
  const ramMb = Math.round((process.memoryUsage().rss / 1024 / 1024) * 10) / 10;
  const pingRaw = client?.ws?.ping;
  const pingValid = pingRaw !== undefined && pingRaw >= 0;
  const pingMs = pingValid ? `${Math.round(pingRaw as number)}ms` : 'calculando...';
  return `RAM ${ramMb}MB • ${pingMs}`;
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
  // Salto de línea (no console.clear) para no partir el recuadro en PowerShell
  if (process.stdout.isTTY) {
    console.log('');
  }

  const separatorWidth = 108;
  const separator = '─'.repeat(separatorWidth);
  const boxWidth = 46;
  const boxLine = '─'.repeat(boxWidth);
  const row = (text: string) => `│ ${pad(text, boxWidth - 2)} │`;

  const pingText = info.client?.ws?.ping !== undefined && info.client.ws.ping >= 0
    ? `${Math.round(info.client.ws.ping)}ms`
    : 'calculando...';

  console.log(`╭${boxLine}╮`);
  console.log(row('CUBITOS MUSIC v1.1.0'));
  console.log(row(`Bot: ${info.botTag}`));
  console.log(row(`Servidor: ${info.guildName}`));
  console.log(row(`Node: ${process.version}`));
  console.log(row(`Spotify: ${info.spotifyEnabled ? 'activado' : 'sin credenciales'}`));
  console.log(row(`Ping: ${pingText} • RAM: ${Math.round(process.memoryUsage().rss / 1024 / 1024 * 10) / 10}MB • Extractores: ${info.extractorCount}`));
  console.log(`╰${boxLine}╯`);
  console.log(separator);
  console.log('HORA       EVENTO          CANAL        DETALLES                          MÉTRICAS');
  console.log(separator);
}

export interface LogRowOptions {
  badge: string;
  color: LogColor;
  channel?: string | null;
  detail: string;
  metrics?: string;
  rawJson?: Record<string, unknown>;
}

/** Imprime una fila de la tabla de logs con columnas alineadas y color por columna. */
export function logRow(opts: LogRowOptions): void {
  const time = formatLogTime();
  const badgeText = `[${opts.badge}]`;
  const badgeCol = paint(opts.color, `${ANSI_COLORS.bold}${badgeText}${ANSI_COLORS.reset}`);
  const channelText = opts.channel ? `#${opts.channel}` : '-';
  const channelCol = paint('cyan', channelText);
  const detailRaw = opts.detail;
  const detail = detailRaw.length > 50 ? `${detailRaw.slice(0, 50)}…` : detailRaw;
  const detailCol = detail;
  const metricsCol = paint('gray', opts.metrics ?? '');

  const line = `${paint('gray', time)}  ${badgeCol}  ${channelCol}  ${detailCol}  ${metricsCol}`;
  console.log(line);

  if (process.env.LOG_TO_FILE === 'true' && opts.rawJson) {
    const logDir = join(process.cwd(), 'logs');
    mkdirSync(logDir, { recursive: true });
    appendFileSync(
      join(logDir, 'playback.jsonl'),
      `${JSON.stringify({ timestamp: new Date().toISOString(), ...opts.rawJson })}\n`,
    );
  }
}
