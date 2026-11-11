export async function replyWithError(interaction: any, content: string): Promise<void> {
  try {
    const payload = { content, flags: 64 };
    if (interaction.deferred) {
      await interaction.editReply(payload);
    } else if (interaction.replied) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  } catch (error) {
    console.error('❌ No se pudo responder al error de interacción:', error);
  }
}
