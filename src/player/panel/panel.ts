import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, EmbedBuilder, Message } from 'discord.js';
import type { Client } from 'discord.js';
import { GuildQueue, Track } from 'discord-player';
import { logRow } from '../../utils/logger.js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const panelMessages = new Map<string, Message>();
const startedAtByGuild = new Map<string, Date>();
const panelLocks = new Map<string, Promise<void>>();

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function getPanelMessage(guildId: string): Message | undefined {
  return panelMessages.get(guildId);
}

export function getStartedAt(guildId: string): Date {
  return startedAtByGuild.get(guildId) ?? new Date();
}

export function setStartedAt(guildId: string, date: Date) {
  startedAtByGuild.set(guildId, date);
}

const DEFAULT_PANEL_STATE_PATH = join(process.cwd(), 'logs', 'panel-state.json');

function resolvePanelStatePath(stateFilePath?: string | { stateFilePath?: string }): string {
  if (typeof stateFilePath === 'string' && stateFilePath.trim()) return stateFilePath;
  if (stateFilePath && typeof stateFilePath === 'object' && 'stateFilePath' in stateFilePath) {
    const candidate = (stateFilePath as { stateFilePath?: string }).stateFilePath;
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
  }
  return DEFAULT_PANEL_STATE_PATH;
}

function readPanelState(filePath: string): Record<string, { channelId: string; messageId: string }> {
  try {
    const raw = readFileSync(filePath, 'utf8');
    if (!raw.trim()) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, { channelId: string; messageId: string }>;
    }
    return {};
  } catch {
    return {};
  }
}

function writePanelState(filePath: string, state: Record<string, { channelId: string; messageId: string }>): void {
  try {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf8');
  } catch {
    // Ignora errores de E/S para no romper la reproducción.
  }
}

export function setPanelMessage(guildId: string, message: Message, stateFilePath?: string | { stateFilePath?: string }) {
  panelMessages.set(guildId, message);

  const filePath = resolvePanelStatePath(stateFilePath);
  const state = readPanelState(filePath);
  state[guildId] = { channelId: message.channelId, messageId: message.id };
  writePanelState(filePath, state);
}

export function deletePanelMessage(guildId: string, stateFilePath?: string | { stateFilePath?: string }) {
  panelMessages.delete(guildId);
  startedAtByGuild.delete(guildId);
  panelLocks.delete(guildId);

  const filePath = resolvePanelStatePath(stateFilePath);
  const state = readPanelState(filePath);
  if (Object.prototype.hasOwnProperty.call(state, guildId)) {
    delete state[guildId];
    writePanelState(filePath, state);
  }
}

/**
 * Embed compartido del cierre «Cola finalizada», usado tanto en `updateEmptyPanel`
 * como en la limpieza de paneles huérfanos al arrancar.
 */
export function buildClosedPanelEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('📭 Cola finalizada')
    .setDescription(
      'Me desconecté del canal de voz porque no quedan canciones en la cola.\n'
      + 'Usa `/play` cuando quieras volver a escuchar música.',
    )
    .setFooter({ text: 'CubitoMusic' })
    .setTimestamp();
}

function isHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

/**
 * GIF del icono animado del autor mientras hay reproducción.
 * Configurable con `PANEL_DISC_GIF_URL`; el valor por defecto es un GIF público
 * de música (sustituible por un disco/vinilo girando).
 */
const SPINNING_DISC_GIF = process.env.PANEL_DISC_GIF_URL?.trim()
  || 'https://media.tenor.com/2roX3uxz_68AAAAC/cat-jam-cat.gif';

/**
 * Texto de progreso del panel (primera línea de la descripción).
 *
 * En vez de la barra ASCII se muestra la duración total y, al reproducir, una
 * cuenta regresiva nativa de Discord (`<t:UNIX:R>`) calculada con el tiempo
 * restante real. Al reanudar tras una pausa, `nowMs + remainingMs` vuelve a
 * dar un fin correcto porque el timestamp se recalcula en cada render.
 */
export function formatPanelProgress(track: Track, queue: GuildQueue, nowMs: number = Date.now()): string {
  const ts = queue.node?.getTimestamp?.();

  if (queue.node?.isPaused?.()) {
    return ts?.current?.label && ts?.total?.label
      ? `⏸️ ${ts.current.label} / ${ts.total.label}`
      : `⏸️ ${track.duration || '—'}`;
  }

  const totalMs = ts?.total?.value ?? track.durationMS ?? 0;
  const currentMs = ts?.current?.value ?? 0;

  if (totalMs > 0) {
    const remainingMs = Math.max(0, totalMs - currentMs);
    const endUnix = Math.floor((nowMs + remainingMs) / 1000);
    return `${ts?.total?.label || track.duration} • termina <t:${endUnix}:R>`;
  }

  return track.duration || 'En vivo';
}

/**
 * Embed principal del panel de reproducción (estilo compacto):
 * autor con GIF animado mientras suena, descripción de dos líneas y footer de estado.
 *
 * @param startedAt Se conserva por compatibilidad con los eventos del player;
 *   el tiempo ya no se renderiza como campo propio.
 */
export function buildPanelEmbed(track: Track, queue: GuildQueue, startedAt: Date, fallbackRequestedBy?: string) {
  const isPaused = Boolean(queue.node?.isPaused?.());
  // Prioridad: solicitante de la pista actual (una cola puede tener varios usuarios).
  const requester = track.requestedBy?.username || fallbackRequestedBy || 'Desconocido';
  // Con mención si conocemos el id; si no, el nombre (o el fallback de la cola).
  const requesterLabel = track.requestedBy?.id ? `<@${track.requestedBy.id}>` : requester;

  const description = [
    `${formatPanelProgress(track, queue)} • ${requesterLabel}`,
    `Por **${track.author || 'Desconocido'}**`,
  ].join('\n');

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(track.title)
    .setAuthor(
      isPaused
        // Sin iconURL animado: el GIF se detiene visualmente al pausar.
        ? { name: 'En pausa' }
        : { name: 'Reproduciendo', iconURL: SPINNING_DISC_GIF },
    )
    .setDescription(description)
    .setFooter({
      text: `${isPaused ? 'En pausa' : 'Reproduciendo'} • Vol ${queue.node.volume}% • Cola: ${queue.tracks.data.length} • Loop: ${queue.repeatMode ? 'on' : 'off'}`,
    })
    .setTimestamp();

  // `EmbedBuilder` valida URL/miniatura: con metadatos incompletos lanzaría y
  // dejaría el panel sin actualizar. Solo se aplican si son http(s) válidas.
  if (isHttpUrl(track.url)) embed.setURL(track.url);
  if (isHttpUrl(track.thumbnail)) embed.setThumbnail(track.thumbnail);

  return embed;
}

export type PanelRowState = {
  canBack?: boolean;
  canShuffle?: boolean;
  hasQueue?: boolean;
};

export function getPanelRowState(queue: GuildQueue): PanelRowState {
  const queuedTracks = queue.tracks?.size ?? 0;
  const historyIsEmpty = typeof queue.history?.isEmpty === 'function'
    ? queue.history.isEmpty()
    : (queue.history?.tracks?.size ?? 0) === 0;

  return {
    canBack: !historyIsEmpty,
    canShuffle: queuedTracks > 0,
    hasQueue: queuedTracks > 0,
  };
}

export function buildPanelRows(
  isPaused: boolean,
  repeatMode: number = 0,
  state?: PanelRowState,
) {
  const back = new ButtonBuilder()
    .setCustomId('panel_back')
    .setEmoji('⏮️')
    .setLabel('Atrás')
    .setStyle(ButtonStyle.Secondary);
  if (state?.canBack === false) back.setDisabled(true);

  const pause = new ButtonBuilder()
    .setCustomId('panel_pause')
    .setEmoji(isPaused ? '▶️' : '⏸️')
    .setLabel(isPaused ? 'Reanudar' : 'Pausar')
    .setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Secondary);

  const skip = new ButtonBuilder()
    .setCustomId('panel_skip')
    .setEmoji('⏭️')
    .setLabel('Saltar')
    .setStyle(ButtonStyle.Primary);

  const stop = new ButtonBuilder()
    .setCustomId('panel_stop')
    .setEmoji('⏹️')
    .setLabel('Stop')
    .setStyle(ButtonStyle.Danger);

  const queueBtn = new ButtonBuilder()
    .setCustomId('panel_queue')
    .setEmoji('📋')
    .setLabel('Cola')
    .setStyle(ButtonStyle.Secondary);
  if (state?.hasQueue === false) queueBtn.setDisabled(true);

  const loop = new ButtonBuilder()
    .setCustomId('panel_loop')
    .setEmoji('🔁')
    .setLabel('Loop')
    .setStyle(repeatMode !== 0 ? ButtonStyle.Success : ButtonStyle.Secondary);

  const shuffle = new ButtonBuilder()
    .setCustomId('panel_shuffle')
    .setEmoji('🔀')
    .setLabel('Mezclar')
    .setStyle(ButtonStyle.Secondary);
  if (state?.canShuffle === false) shuffle.setDisabled(true);

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(back, pause, skip, stop, queueBtn);
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(loop, shuffle);

  return [row1, row2];
}

function withPanelLock(guildId: string, task: () => Promise<void>) {
  const prev = panelLocks.get(guildId) ?? Promise.resolve();
  const next = prev
    .catch((error) => {
      logRow({
        badge: 'ERROR',
        color: 'red',
        detail: `Error en actualización previa del panel (${guildId}): ${errorText(error)}`,
      });
    })
    .then(task)
    .catch((error) => {
      logRow({
        badge: 'ERROR',
        color: 'red',
        detail: `Error actualizando el panel (${guildId}): ${errorText(error)}`,
      });
    })
    .finally(() => {
      // Libera el lock cuando la cadena termina, salvo que ya exista una más reciente.
      if (panelLocks.get(guildId) === next) panelLocks.delete(guildId);
    });
  panelLocks.set(guildId, next);
  return next;
}

export async function updatePanel(channel: any, embed: EmbedBuilder, rows: ActionRowBuilder<ButtonBuilder>[]) {
  if (!channel) return;

  const guildId = channel.guildId;
  const payload = {
    embeds: [embed],
    components: rows,
  };

  return withPanelLock(guildId, async () => {
    const existing = getPanelMessage(guildId);
    if (existing && existing.editable) {
      try {
        await existing.edit(payload);
        return;
      } catch {
        // El mensaje ya no es editable: eliminar referencia y limpiar el viejo si sigue existiendo
        deletePanelMessage(guildId);
        try {
          if (existing.deletable) await existing.delete();
        } catch {}
      }
    }

    try {
      const message = await channel.send(payload);
      setPanelMessage(guildId, message);
    } catch (error) {
      logRow({
        badge: 'ERROR',
        color: 'red',
        channel: channel?.name,
        detail: `Error enviando panel: ${errorText(error)}`,
      });
    }
  });
}

export async function updateEmptyPanel(channel: any) {
  if (!channel) return;

  const guildId = channel.guildId;
  return withPanelLock(guildId, async () => {
    const existing = getPanelMessage(guildId);
    if (!existing) return;

    const disabledRows = existing.components
      .filter(row => row.type === ComponentType.ActionRow)
      .map(row =>
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          row.components.map(c => ButtonBuilder.from(c as any).setDisabled(true))
        )
      );

    try {
      await existing.edit({
        embeds: [buildClosedPanelEmbed()],
        components: disabledRows,
      });
      // Panel deshabilitado en Discord: liberamos la referencia para no retener el Message en RAM
      // y permitir que la próxima sesión cree un panel limpio. También limpia `panelLocks`.
      deletePanelMessage(guildId);
    } catch (error) {
      deletePanelMessage(guildId);
      logRow({
        badge: 'ERROR',
        color: 'red',
        channel: channel?.name,
        detail: `Error actualizando el panel de cola vacía: ${errorText(error)}`,
      });
    }
  });
}


export async function cleanupOrphanedPanels(client: Client, stateFilePath?: string | { stateFilePath?: string }): Promise<void> {
  const filePath = resolvePanelStatePath(stateFilePath);
  let state = readPanelState(filePath);

  for (const [guildId, ref] of Object.entries(state)) {
    try {
      const channel = await client.channels.fetch(ref.channelId) as any;
      if (channel && typeof channel.messages?.fetch === 'function') {
        try {
          const message = await channel.messages.fetch(ref.messageId);
          if (message && message.editable) {
            const disabledRows = (message.components ?? [])
              .filter((row: any) => row?.type === ComponentType.ActionRow)
              .map((row: any) =>
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                  (row.components ?? []).map((component: any) => ButtonBuilder.from(component as any).setDisabled(true)),
                ),
              );
            await message.edit({ embeds: [buildClosedPanelEmbed()], components: disabledRows });
          }
        } catch {
          // Mensaje ya borrado (10008) u otro error: se ignora.
        }
      }
    } catch {
      // Canal ya borrado (10003) u otro error: se ignora.
    }

    delete state[guildId];
    writePanelState(filePath, state);
  }

  // Garantiza que el archivo refleje el estado final (vacío si todo se procesó).
  writePanelState(filePath, state);
}
