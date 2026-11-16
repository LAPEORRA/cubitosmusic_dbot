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

export interface SerializedError {
  name: string;
  message: string;
  code: string | number | null;
  stack: string | null;
  cause: SerializedError | null;
}

export function serializeError(err: unknown): SerializedError {
  const seen = new WeakSet<object>();

  const serialize = (value: unknown): SerializedError => {
    const isObject = (typeof value === 'object' && value !== null) || typeof value === 'function';
    if (isObject && seen.has(value)) {
      return { name: 'Error', message: '[Circular cause]', code: null, stack: null, cause: null };
    }
    if (isObject) seen.add(value);

    const error = value instanceof Error ? value : null;
    const record = isObject ? value as Record<string, unknown> : undefined;
    const rawCode = record?.code;
    const cause = error?.cause ?? record?.cause;

    return {
      name: error?.name ?? (typeof record?.name === 'string' ? record.name : 'Error'),
      message: error?.message ?? (typeof record?.message === 'string' ? record.message : String(value)),
      code: typeof rawCode === 'string' || typeof rawCode === 'number' ? rawCode : null,
      stack: typeof error?.stack === 'string'
        ? error.stack
        : typeof record?.stack === 'string'
          ? record.stack
          : null,
      cause: cause === undefined ? null : serialize(cause),
    };
  };

  return serialize(err);
}

export type TraceCategory = 'cmd' | 'timing' | 'audio' | 'voice' | 'debug' | 'error';

export function traceEvent(
  category: TraceCategory,
  event: string,
  data: Record<string, unknown> = {},
): void {
  if (process.env.LIVE_TRACE !== 'true' && process.env.LOG_TO_FILE !== 'true') return;

  const logDir = join(process.cwd(), 'logs');
  mkdirSync(logDir, { recursive: true });
  appendFileSync(
    join(logDir, 'live-trace.jsonl'),
    `${JSON.stringify({ timestamp: new Date().toISOString(), category, event, ...data })}\n`,
  );
}

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

/** Ajusta el texto exactamente a `width`: rellena con espacios o trunca con `…`. */
function fit(text: string, width: number): string {
  const value = String(text);
  if (value.length > width) {
    return width > 0 ? `${value.slice(0, width - 1)}…` : '';
  }
  return pad(value, width);
}

/** Trunca con `…` solo si excede `max` (no rellena). */
function truncate(text: string, max: number): string {
  return text.length > max && max > 0 ? `${text.slice(0, max - 1)}…` : text;
}

/** Anchos de columna de la tabla de logs (en caracteres visibles). */
const COL_TIME = 10;
const COL_BADGE = 12;
const COL_CHANNEL = 16;
const COL_DETAIL = 52;

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

  const pingText = info.client?.ws?.ping !== undefined && info.client.ws.ping >= 0
    ? `${Math.round(info.client.ws.ping)}ms`
    : 'calculando...';
  const ramMb = Math.round((process.memoryUsage().rss / 1024 / 1024) * 10) / 10;

  const lines = [
    'CUBITOS MUSIC v1.1.0',
    `Bot: ${info.botTag}`,
    `Servidor: ${info.guildName}`,
    `Node: ${process.version}`,
    `Spotify: ${info.spotifyEnabled ? 'activado' : 'sin credenciales'}`,
    `Ping: ${pingText} • RAM: ${ramMb}MB • Extractores: ${info.extractorCount}`,
  ].map((text) => truncate(text, 60));

  // Ancho dinámico: el recuadro se ajusta al contenido (mínimo 44) y así el borde derecho queda alineado.
  const textWidth = lines.reduce((max, text) => Math.max(max, text.length), 44);
  const boxInner = textWidth + 2;
  const boxLine = '─'.repeat(boxInner);
  const row = (text: string) => `│ ${pad(text, textWidth)} │`;

  const header = `  ${pad('HORA', COL_TIME)}${pad('EVENTO', COL_BADGE)}${pad('CANAL', COL_CHANNEL)}${pad('DETALLES', COL_DETAIL)} MÉTRICAS`;
  const separator = '─'.repeat(header.length);

  console.log(`╭${boxLine}╮`);
  for (const text of lines) {
    console.log(row(text));
  }
  console.log(`╰${boxLine}╯`);
  console.log(separator);
  console.log(header);
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

/** Colapsa saltos de línea, tabulaciones y espacios múltiples en una sola línea. */
function singleLine(text: string): string {
  return String(text).replace(/\s+/g, ' ').trim();
}

export function summarizePlayerError(rawMessage: string): string {
  const lines = rawMessage
    .split(/\r?\n/)
    .map((line) => {
      let summary = line.trim();
      let previous: string;

      do {
        previous = summary;
        summary = summary
          .replace(/^yt-dlp exited code=\d+:?\s*/i, '')
          .replace(/^(?:ERROR|WARNING):\s*/i, '')
          .replace(/^\[youtube\]\s+[^:\s]+:\s*/i, '')
          .trim();
      } while (summary !== previous);

      return summary;
    })
    .filter(Boolean);

  return lines.length > 0 ? singleLine(lines.join(' ')) : singleLine(rawMessage);
}

/** Imprime una fila de la tabla de logs con columnas alineadas y color por columna. */
export function logRow(opts: LogRowOptions): void {
  const time = formatLogTime();
  const badgeText = `[${singleLine(opts.badge)}]`;
  const badgeCol = paint(opts.color, `${ANSI_COLORS.bold}${fit(badgeText, COL_BADGE)}${ANSI_COLORS.reset}`);
  const channelText = opts.channel ? `#${singleLine(opts.channel)}` : '-';
  const channelCol = paint('cyan', fit(channelText, COL_CHANNEL));
  const detailRaw = singleLine(opts.detail);
  const detailTruncated = detailRaw.length > 50 ? `${detailRaw.slice(0, 50)}…` : detailRaw;
  const detailCol = pad(detailTruncated, COL_DETAIL);
  const metricsCol = paint('gray', singleLine(opts.metrics ?? ''));

  const line = `  ${paint('gray', pad(time, COL_TIME))}${badgeCol}${channelCol}${detailCol} ${metricsCol}`;
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
