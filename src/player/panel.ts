import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, EmbedBuilder, Message } from 'discord.js';
import { GuildQueue, Track } from 'discord-player';

const panelMessages = new Map<string, Message>();
const startedAtByGuild = new Map<string, Date>();
const panelLocks = new Map<string, Promise<void>>();

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
}

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'ahora mismo';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `hace ${hours} h`;
}

export function buildPanelEmbed(track: Track, queue: GuildQueue, startedAt: Date, requestedBy?: string) {
  const progress = queue.node.createProgressBar({ timecodes: true });
  const requester = requestedBy || (track.requestedBy?.username as string | undefined) || 'Desconocido';

  const commands = [
    '→ `/play <url|búsqueda>` | `/pause` | `/resume`',
    '→ `/skip` | `/stop` | `/loop` | `/shuffle`',
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

export function buildPanelRows(isPaused: boolean) {
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

  return new ActionRowBuilder<ButtonBuilder>().addComponents(back, pause, skip, stop, queueBtn);
}

function withPanelLock(guildId: string, task: () => Promise<void>) {
  const prev = panelLocks.get(guildId) ?? Promise.resolve();
  const next = prev
    .catch(() => {})
    .then(task)
    .catch(() => {});
  panelLocks.set(guildId, next);
  return next;
}

export async function updatePanel(channel: any, embed: EmbedBuilder, rows: ActionRowBuilder<ButtonBuilder>) {
  if (!channel) return;

  const guildId = channel.guildId;
  const payload = {
    embeds: [embed],
    components: [rows],
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
      console.error('❌ Error enviando panel:', error);
    }
  });
}

export async function updateEmptyPanel(channel: any) {
  if (!channel) return;

  const guildId = channel.guildId;
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
  } catch {
    deletePanelMessage(guildId);
  }
}