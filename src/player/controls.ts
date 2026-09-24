import { GuildMember } from 'discord.js';
import { GuildQueue } from 'discord-player';
import { useQueue } from 'discord-player';

type InteractionLike = {
  guildId: string;
  member: GuildMember | null;
};

function getMemberVoiceChannel(interaction: InteractionLike) {
  return interaction.member?.voice?.channel ?? null;
}

export function requireVoiceChannel(interaction: InteractionLike) {
  return getMemberVoiceChannel(interaction) !== null;
}

export function getQueue(interaction: InteractionLike): GuildQueue | null {
  return useQueue(interaction.guildId);
}

export function togglePause(queue: GuildQueue): boolean {
  if (queue.node.isPaused()) {
    queue.node.resume();
    return false; // ahora reproduciendo
  }
  queue.node.pause();
  return true; // ahora pausado
}

export function skipTrack(queue: GuildQueue): boolean {
  if (!queue.isPlaying() && !queue.node.isPaused()) return false;
  queue.node.skip();
  return true;
}

export async function backTrack(queue: GuildQueue): Promise<boolean> {
  if (!queue.history || queue.history.isEmpty()) return false;
  await queue.history.previous();
  return true;
}

export function toggleLoop(queue: GuildQueue) {
  if (queue.repeatMode === 1) queue.setRepeatMode(0);
  else queue.setRepeatMode(1);
  return queue.repeatMode;
}

export function shuffleQueue(queue: GuildQueue): boolean {
  if (!queue.tracks.data.length) return false;
  queue.tracks.shuffle();
  return true;
}

export async function stopQueue(queue: GuildQueue) {
  queue.delete();
}