import { GuildMember } from 'discord.js';
import { GuildQueue, Track } from 'discord-player';
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

export function isSameVoiceChannel(
  memberChannelId: string | null | undefined,
  botChannelId: string | null | undefined,
): boolean {
  return Boolean(memberChannelId && botChannelId && memberChannelId === botChannelId);
}

export function requireSameVoiceChannel(interaction: InteractionLike, queue: GuildQueue): boolean {
  return isSameVoiceChannel(interaction.member?.voice?.channelId, queue.channel?.id);
}

/**
 * El bot solo puede estar en un canal de voz: si aún no tiene cola/canal,
 * se permite cualquier canal; si ya está conectado, debe coincidir.
 */
export function canPlayInChannel(
  botChannelId: string | null | undefined,
  userChannelId: string | null | undefined,
): boolean {
  if (!botChannelId) return true;
  return botChannelId === userChannelId;
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

/** Vacía la cola. Devuelve `true` si había canciones. */
export function clearQueue(queue: GuildQueue): boolean {
  if (!queue.tracks.size) return false;
  queue.tracks.clear();
  return true;
}

/** Elimina la pista en `position` (1-based). Devuelve la pista o `null` si no existe. */
export function removeTrack(queue: GuildQueue, position: number): Track | null {
  const index = position - 1;
  const track = queue.tracks.at(index);
  if (!track) return null;
  queue.tracks.removeOne((_track, idx) => idx === index);
  return track;
}

/** Salta a la pista en `position` (1-based) y la devuelve; `null` si no existe o falla. */
export function skipTo(queue: GuildQueue, position: number): Track | null {
  const target = queue.tracks.at(position - 1) ?? null;
  if (!target) return null;
  if (!queue.node.skipTo(position - 1)) return null;
  return target;
}

export async function stopQueue(queue: GuildQueue) {
  queue.delete();
}