import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('queue')
  .setDescription('Muestra la cola de reproducción actual');

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: false });

  // Por ahora respuesta básica - se integrará con el player real
  const player = (interaction.client as any).player;

  if (!player) {
    return interaction.editReply({ content: '❌ No hay música reproduciéndose.', ephemeral: true });
  }

  // TODO: Mostrar cola real del player
  await interaction.editReply({ content: '📋 Cola de reproducción (próximamente).', ephemeral: false });
}

export default { data, execute };