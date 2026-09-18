import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('pause')
  .setDescription('Pausa o reanuda la reproducción');

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: false });

  const player = (interaction.client as any).player;

  if (!player) {
    return interaction.editReply({ content: '❌ Player no inicializado.', ephemeral: true });
  }

  try {
    if (player.paused) {
      player.pause();
      await interaction.editReply({ content: '▶️ Reproducción reanudada.', ephemeral: false });
    } else {
      player.pause(true);
      await interaction.editReply({ content: '⏸️ Reproducción pausada.', ephemeral: false });
    }
  } catch (error) {
    console.error('❌ Error al pausar/reanudar:', error);
    await interaction.editReply({ content: '❌ Error al controlar la reproducción.', ephemeral: true });
  }
}

export default { data, execute };