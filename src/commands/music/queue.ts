import { SlashCommandBuilder } from 'discord.js';
import { useQueue } from 'discord-player';
import { buildQueueEmbed } from '../../player/queueSummary.js';

type QueueState = {
  currentTrack: { title: string; author: string; duration?: string; thumbnail?: string } | null;
  tracks: {
    data: readonly { title: string; author: string; duration?: string; thumbnail?: string }[];
  };
};

export const data = new SlashCommandBuilder()
  .setName('queue')
  .setDescription('Muestra la cola de reproducción');

export async function queue(
  interaction: any,
  queueState: QueueState | null = useQueue(interaction.guildId),
) {
  const payload = {
    embeds: [buildQueueEmbed(queueState?.currentTrack ?? null, queueState?.tracks.data ?? [])],
    allowedMentions: { parse: [] },
  };

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(payload);
  } else {
    await interaction.reply(payload);
  }
}
