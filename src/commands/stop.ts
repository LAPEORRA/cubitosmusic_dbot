import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('stop')
  .setDescription('Detiene la música y desconecta');

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: false });

  const voiceChannel = interaction.member?.voice.channel;
  const player = (interaction.client as any).player;

  if (!voiceChannel) {
    return interaction.editReply({ content: '❌ No estás en un canal de voz.', ephemeral: true });
  }

  try {
    // Detener el player y limpiar la cola
    if (player) {
      player.stop();
    }

    // Desconectar del canal de voz
    await voiceChannel.leave();

    await interaction.editReply({ content: '⏹️ Música detenida y bot desconectado.', ephemeral: false });
  } catch (error) {
    console.error('❌ Error al detener música:', error);
    await interaction.editReply({ content: '❌ Error al detener la música.', ephemeral: true });
  }
}

export default { data, execute };