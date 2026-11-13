import { useQueue } from 'discord-player';
import {
  backTrack,
  skipTrack,
  stopQueue,
  togglePause,
  requireVoiceChannel,
  requireSameVoiceChannel,
} from '../controls.js';
import {
  buildPanelEmbed,
  buildPanelRows,
  getStartedAt,
  updatePanel,
  updateEmptyPanel,
} from './panel.js';
import { buildQueueReply } from '../queueSummary.js';
import { logRow } from '../../utils/logger.js';

export async function handlePanelButton(interaction: any) {
  const customId = interaction.customId as string;

  if (!requireVoiceChannel(interaction)) {
    return interaction.reply({ content: '❌ Necesitas estar en un canal de voz.', flags: 64, ephemeral: true });
  }

  const queue = useQueue(interaction.guildId);
  if (!queue || !queue.currentTrack) {
    return interaction.reply({ content: '❌ No hay reproducción activa.', flags: 64, ephemeral: true });
  }

  if (customId !== 'panel_queue' && !requireSameVoiceChannel(interaction, queue)) {
    return interaction.reply({
      content: '❌ Debes estar en el mismo canal de voz que el bot.',
      flags: 64,
      ephemeral: true,
    });
  }

  await interaction.deferUpdate();

  const channel = (queue.metadata as any)?.channel;

  logRow({
    badge: 'BOTÓN',
    color: 'magenta',
    channel: interaction.channel?.name,
    detail: `Clic en ${customId.replace('panel_', '')}`,
  });

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
      return interaction.followUp({
        ...buildQueueReply(queue.currentTrack, queue.tracks.data),
        flags: 64,
        ephemeral: true,
      });
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