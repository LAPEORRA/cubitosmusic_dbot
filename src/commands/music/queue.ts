import { SlashCommandBuilder } from 'discord.js';
import { useQueue } from 'discord-player';
import { buildQueueReply } from '../../player/queueSummary.js';

type QueueState = {
  currentTrack: { title: string; author: string } | null;
  tracks: { data: readonly { title: string; author: string }[] };
};

export const data = new SlashCommandBuilder()
  .setName('queue')
  .setDescription('Muestra la cola de reproducción');

export async function queue(
  interaction: any,
  queueState: QueueState | null = useQueue(interaction.guildId),
) {
  const reply = buildQueueReply(queueState?.currentTrack ?? null, queueState?.tracks.data ?? []);

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({ ...reply, flags: 64 });
  } else {
    await interaction.reply({ ...reply, flags: 64 });
  }
}
