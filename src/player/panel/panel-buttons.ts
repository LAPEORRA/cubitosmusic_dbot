import { useQueue } from 'discord-player';
import type { GuildQueue } from 'discord-player';
import {
  backTrack,
  skipTrack,
  stopQueue,
  togglePause,
  toggleLoop,
  shuffleQueue,
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
import { logRow, traceEvent } from '../../utils/logger.js';

export async function handlePanelButton(
  interaction: any,
  resolveQueue: (guildId: string) => GuildQueue | null = useQueue,
) {
  const customId = interaction.customId as string;

  if (!requireVoiceChannel(interaction)) {
    return interaction.reply({ content: '❌ Necesitas estar en un canal de voz.', flags: 64 });
  }

  const queue = resolveQueue(interaction.guildId);
  if (!queue || !queue.currentTrack) {
    return interaction.reply({ content: '❌ No hay reproducción activa.', flags: 64 });
  }

  if (customId !== 'panel_queue' && !requireSameVoiceChannel(interaction, queue)) {
    return interaction.reply({
      content: '❌ Debes estar en el mismo canal de voz que el bot.',
      flags: 64,
    });
  }

  const deferStartedAt = performance.now();
  try {
    await interaction.deferUpdate();
  } finally {
    traceEvent('timing', 'panel_defer_update', {
      interactionId: interaction.id,
      customId,
      deferMs: performance.now() - deferStartedAt,
    });
  }

  const channel = (queue.metadata as any)?.channel;

  // Debe ir después de `deferUpdate()`: si el defer falla, no queremos un log
  // [BOTÓN] que parezca ejecutado antes del error correspondiente.
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
    case 'panel_loop': {
      toggleLoop(queue);
      break;
    }
    case 'panel_shuffle': {
      if (!shuffleQueue(queue)) {
        return interaction.followUp({
          content: '📭 No hay canciones en la cola para mezclar.',
          flags: 64,
        });
      }
      break;
    }
    case 'panel_back': {
      const ok = await backTrack(queue);
      if (!ok) {
        return interaction.followUp({ content: '❌ No hay pista anterior.', flags: 64 });
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
      });
    }
    default:
      return;
  }

  // `loop`/`shuffle` no emiten eventos del player (a diferencia de pause/skip),
  // así que refrescamos el panel aquí; el resto lo hace `ready.ts`.
  if (customId === 'panel_loop' || customId === 'panel_shuffle') {
    const current = queue.currentTrack;
    if (current && channel) {
      const embed = buildPanelEmbed(current, queue, getStartedAt(queue.guild.id));
      await updatePanel(channel, embed, buildPanelRows(queue.node.isPaused(), queue.repeatMode));
    }
  }
}