import { Client, Events } from 'discord.js';
import { useMainPlayer } from 'discord-player';

export const ready = async (client: Client) => {
  console.log(`✅ Bot listo como: ${client.user?.tag}`);

  // Obtener el player principal - discord-player lo crea automáticamente
  const player = useMainPlayer();

  // Registrar eventos del player
  player.on('play', (queue, track) => {
    console.log(`🎵 Tocando: ${track.title} en ${queue.channel.name}`);
  });

  player.on('error', (queue, error) => {
    console.error('❌ Error en el player:', error);
  });

  player.on('empty', (queue) => {
    console.log('📭 Cola vacía, desconectando...');
  });

  // Sincronizar comandos de slash en el servidor de desarrollo
  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const application = await client.application?.fetch();

    if (guild && application) {
      const commands = application.commands;
      console.log(`📝 Comandos disponibles en guild ${guild.name}`);
    }
  } catch (error) {
    console.error('❌ Error sincronizando comandos:', error);
  }
};

export default { ready };