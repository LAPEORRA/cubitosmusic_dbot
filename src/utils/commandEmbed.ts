import { EmbedBuilder } from 'discord.js';

export type CommandEmbedOptions = {
  author?: string;
  title?: string;
  url?: string;
  description: string;
  footer?: string;
  thumbnail?: string;
};

function isHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

/**
 * Mini-embed estándar para las confirmaciones de comandos (públicas en el canal).
 *
 * Centraliza el color de marca y evita que `EmbedBuilder` lance con URLs o
 * miniaturas inválidas: solo se aplican si son `http(s)`.
 */
export function buildCommandEmbed(opts: CommandEmbedOptions): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setDescription(opts.description);

  if (opts.author) embed.setAuthor({ name: opts.author });
  if (opts.title) embed.setTitle(opts.title);
  if (isHttpUrl(opts.url)) embed.setURL(opts.url);
  if (isHttpUrl(opts.thumbnail)) embed.setThumbnail(opts.thumbnail);
  if (opts.footer) embed.setFooter({ text: opts.footer });

  return embed;
}
