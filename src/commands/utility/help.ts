import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Muestra los comandos disponibles del bot');

const CATEGORY_LABELS: Record<string, string> = {
  music: '🎵 Música',
  utility: '🛠️ Utilidades',
};

function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category.charAt(0).toUpperCase() + category.slice(1);
}

export async function help(interaction: any) {
  // Import dinámico: el registro importa este comando, así que un import
  // estático de `../index.js` crearía un ciclo durante la inicialización ESM.
  const { commands } = await import('../index.js');

  const grouped = new Map<string, string[]>();
  for (const command of commands) {
    const label = categoryLabel(command.category);
    const lines = grouped.get(label) ?? [];
    lines.push(`• \`/${command.data.name}\` — ${command.help ?? command.data.description}`);
    grouped.set(label, lines);
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('📖 Comandos de CubitoMusic')
    .setFooter({ text: 'CubitoMusic' });

  for (const [label, lines] of grouped) {
    embed.addFields({ name: label, value: lines.join('\n') });
  }

  return interaction.reply({ embeds: [embed], flags: 64 });
}
