export interface MusicQueue {
  title: string;
  url: string;
  requester: string;
}

export interface BotConfig {
  discordToken: string;
  clientId: string;
  guildId: string;
  spotifyClientId?: string;
  spotifyClientSecret?: string;
}