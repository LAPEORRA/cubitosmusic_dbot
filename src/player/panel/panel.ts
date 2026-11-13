import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, EmbedBuilder, Message } from 'discord.js';
import { GuildQueue, Track } from 'discord-player';
import { logRow } from '../../utils/logger.js';

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

export function setPanelMessage(guildId: string, message: Message) {
  panelMessages.set(guildId, message);
}

export function deletePanelMessage(guildId: string) {
  panelMessages.delete(guildId);
  startedAtByGuild.delete(guildId);
  panelLocks.delete(guildId);
}

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'ahora mismo';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `hace ${hours} h`;
}

export function buildPanelEmbed(track: Track, queue: GuildQueue, startedAt: Date, fallbackRequestedBy?: string) {
  const progress = queue.node.createProgressBar({ timecodes: true });
  // Prioridad: solicitante de la pista actual (una cola puede tener varios usuarios).
  const requester = track.requestedBy?.username || fallbackRequestedBy || 'Desconocido';

  const commands = [
    '→ `/play <url|búsqueda>` | `/pause` | `/skip` | `/skipto`',
    '→ `/stop` | `/clear` | `/remove` | `/loop` | `/shuffle`',
    '→ `/queue` | `/nowplaying`',
  ].join('\n');

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(track.title)
    .setURL(track.url)
    .setAuthor({ name: track.author || 'Desconocido' })
    .setThumbnail(track.thumbnail)
    .addFields(
      { name: '⏱ Progreso', value: progress || track.duration, inline: true },
      { name: '📌 Añadida', value: timeAgo(startedAt), inline: true },
      { name: '👤 Solicitada por', value: requester, inline: true },
      { name: '📋 Cola', value: `${queue.tracks.data.length} canciones`, inline: true },
      { name: '🛠 Comandos', value: commands, inline: false },
    )
    .setFooter({ text: `CubitoMusic • ${queue.node.volume}% vol` });
}

export function buildPanelRows(isPaused: boolean, repeatMode: number = 0) {
  const back = new ButtonBuilder()
    .setCustomId('panel_back')
    .setEmoji('⏮')
    .setStyle(ButtonStyle.Secondary);

  const pause = new ButtonBuilder()
    .setCustomId('panel_pause')
    .setEmoji(isPaused ? '▶️' : '⏸️')
    .setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Secondary);

  const skip = new ButtonBuilder()
    .setCustomId('panel_skip')
    .setEmoji('⏭')
    .setStyle(ButtonStyle.Primary);

  const stop = new ButtonBuilder()
    .setCustomId('panel_stop')
    .setEmoji('⏹')
    .setStyle(ButtonStyle.Danger);

  const queueBtn = new ButtonBuilder()
    .setCustomId('panel_queue')
    .setEmoji('📋')
    .setStyle(ButtonStyle.Secondary);

  const loop = new ButtonBuilder()
    .setCustomId('panel_loop')
    .setEmoji('🔁')
    .setStyle(repeatMode !== 0 ? ButtonStyle.Success : ButtonStyle.Secondary);

  const shuffle = new ButtonBuilder()
    .setCustomId('panel_shuffle')
    .setEmoji('🔀')
    .setStyle(ButtonStyle.Secondary);

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
        embeds: [new EmbedBuilder()
          .setColor(0x5865f2)
          .setDescription('📭 **Cola vacía** — la reproducción terminó.')
          .setFooter({ text: 'CubitoMusic' })],
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
