import { SlashCommandBuilder } from 'discord.js';
import { createAudioPlayer, AudioPlayerStatus } from '@discordjs/voice';

export const data = new SlashCommandBuilder()
  .setName('skip')
  .setDescription('Siguiente pista');

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: false });

  const player = (interaction.client as any).player;

  if (!player) {
    return interaction.editReply({ content: '❌ Player no inicializado.', ephemeral: true });
  }

  try {
    player.skip();
    await interaction.editReply({ content: '⏭️ Pista saltada.', ephemeral: false });
  } catch (error) {
    console.error('❌ Error al saltar pista:', error);
    await interaction.editReply({ content: '❌ Error al saltar la pista.', ephemeral: true });
  }
}

export default { data, execute };