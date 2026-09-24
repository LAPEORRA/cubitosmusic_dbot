import { useQueue } from 'discord-player';
import {
  backTrack,
  skipTrack,
  stopQueue,
  togglePause,
  requireVoiceChannel,
} from './controls.js';
import {
  buildPanelEmbed,
  buildPanelRows,
  getStartedAt,
  updatePanel,
  updateEmptyPanel,
} from './panel.js';

export async function handlePanelButton(interaction: any) {
  const customId = interaction.customId as string;

  if (!requireVoiceChannel(interaction)) {
    return interaction.reply({ content: '❌ Necesitas estar en un canal de voz.', flags: 64, ephemeral: true });
  }

  const queue = useQueue(interaction.guildId);
  if (!queue || !queue.currentTrack) {
    return interaction.reply({ content: '❌ No hay reproducción activa.', flags: 64, ephemeral: true });
  }

  await interaction.deferUpdate();

  const channel = (queue.metadata as any)?.channel;

  switch (customId) {
    case 'panel_pause': {
      togglePause(queue);
      break;
    }
    case 'panel_skip': {
      skipTrack(queue);
      break;
    }
    case 'panel_back': {
      const ok = await backTrack(queue);
      if (!ok) {
        return interaction.followUp({ content: '❌ No hay pista anterior.', flags: 64, ephemeral: true });
      }
      break;
    }
    case 'panel_stop': {
      await stopQueue(queue);
      await updateEmptyPanel(channel);
      return;
    }
    case 'panel_queue': {
      return interaction.followUp({ content: buildQueueSummary(queue), flags: 64, ephemeral: true });
    }
    default:
      return;
  }

  // Re-render del panel con el estado actualizado
  const current = queue.currentTrack;
  if (current && channel) {
    const embed = buildPanelEmbed(current, queue, getStartedAt(queue.guild.id), (queue.metadata as any)?.requestedBy?.username);
    const rows = buildPanelRows(queue.node.isPaused());
    await updatePanel(channel, embed, rows);
  }
}

function buildQueueSummary(queue: any): string {
  const tracks = queue.tracks.data;
  const current = queue.currentTrack;
  const list = tracks
    .slice(0, 10)
    .map((t: any, i: number) => `${i + 1}. **${t.title}** — ${t.author}`)
    .join('\n');

  const parts: string[] = [];
  if (current) parts.push(`🎵 **Ahora:** ${current.title}`);
  parts.push(`📋 **Cola (${tracks.length}):** ${list || 'vacía'}`);
  if (tracks.length > 10) parts.push(`... y ${tracks.length - 10} más`);
  return parts.join('\n');
}