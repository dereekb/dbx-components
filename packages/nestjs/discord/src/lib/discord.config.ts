import { type ClientOptions, GatewayIntentBits } from 'discord.js';
import { type DiscordBotToken } from './discord.type';

/**
 * Default environment variable for the Discord bot token.
 */
export const DISCORD_BOT_TOKEN_ENV_VAR = 'DISCORD_BOT_TOKEN';

/**
 * Default gateway intents for a bot that reads guild messages.
 *
 * Includes Guilds, GuildMessages, and MessageContent.
 * Note: MessageContent is a privileged intent and must be enabled in the Discord Developer Portal.
 */
export const DISCORD_DEFAULT_INTENTS = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent];

export interface DiscordServiceApiConfig {
  /**
   * The bot token used to authenticate with the Discord gateway.
   */
  readonly botToken: DiscordBotToken;
  /**
   * discord.js Client options. Intents default to DISCORD_DEFAULT_INTENTS if not provided.
   */
  readonly clientOptions?: Partial<ClientOptions>;
  /**
   * Whether to automatically call client.login() during module initialization.
   *
   * Defaults to true.
   */
  readonly autoLogin?: boolean;
}

/**
 * Configuration for the DiscordApi service.
 */
export abstract class DiscordServiceConfig {
  readonly discord!: DiscordServiceApiConfig;

  static assertValidConfig(config: DiscordServiceConfig) {
    if (!config.discord.botToken) {
      throw new Error('No Discord bot token specified.');
    }
  }
}
