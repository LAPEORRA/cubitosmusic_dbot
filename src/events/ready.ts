import { Client } from 'discord.js';
import { Player } from 'discord-player';
import { buildPanelEmbed, buildPanelRows, updatePanel, setStartedAt, getStartedAt, updateEmptyPanel } from '../player/panel.js';

export const ready = async (client: Client, player: Player) => {
  console.log(`✅ Bot listo como: ${client.user?.tag}`);

  // Registrar eventos del player
  player.events.on('playerStart', (queue, track) => {
    console.log(`🎵 Tocando: ${track.title} en ${queue.channel?.name}`);

    const channel = (queue.metadata as any)?.channel as any;
    if (!channel) return;

    setStartedAt(queue.guild.id, new Date());
    const embed = buildPanelEmbed(track, queue, getStartedAt(queue.guild.id), (queue.metadata as any)?.requestedBy?.username);
    const rows = buildPanelRows(queue.node.isPaused());
    void updatePanel(channel, embed, rows);
  });

  player.events.on('playerPause', (queue) => {
    const channel = (queue.metadata as any)?.channel as any;
    const current = queue.currentTrack;
    if (!channel || !current) return;
    const embed = buildPanelEmbed(current, queue, getStartedAt(queue.guild.id), (queue.metadata as any)?.requestedBy?.username);
    const rows = buildPanelRows(true);
    void updatePanel(channel, embed, rows);
  });

  player.events.on('playerResume', (queue) => {
    const channel = (queue.metadata as any)?.channel as any;
    const current = queue.currentTrack;
    if (!channel || !current) return;
    const embed = buildPanelEmbed(current, queue, getStartedAt(queue.guild.id), (queue.metadata as any)?.requestedBy?.username);
    const rows = buildPanelRows(false);
    void updatePanel(channel, embed, rows);
  });

  player.events.on('emptyQueue', (queue) => {
    console.log('📭 Cola vacía, desconectando...');
    const channel = (queue.metadata as any)?.channel as any;
    void updateEmptyPanel(channel);
  });

  player.events.on('queueDelete', (queue) => {
    console.log('🗑 Cola eliminada');
  });

  player.events.on('error', (queue, error) => {
    console.error('❌ Error en el player:', error);
  });

  player.events.on('playerError', (queue, error) => {
    console.error('❌ Error de reproducción:', error);
  });

  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID!);
    console.log(`📝 Bot activo en guild: ${guild.name}`);
  } catch (error) {
    console.error('❌ Error:', error);
  }
};