import { type Maybe } from '@dereekb/util';
import { type ClientOptions, GatewayIntentBits } from 'discord.js';
import { type DiscordBotToken } from './discord.type';

/**
 * Default environment variable for the Discord bot token.
 */
export const DISCORD_BOT_TOKEN_ENV_VAR = 'DISCORD_BOT_TOKEN';

/**
 * Placeholder bot token value used in development and CI environments where a real Discord
 * login should not be attempted. Mirrors the value used in the workspace's .env file.
 */
export const DISCORD_BOT_TOKEN_PLACEHOLDER = 'placeholder';

/**
 * Returns true if the input is a real, usable Discord bot token.
 *
 * A token is usable when it is non-empty and is not the shared placeholder value, allowing
 * non-production environments to skip a real gateway login that would always fail.
 *
 * @param botToken - The bot token read from configuration, if any.
 * @returns True when the token should be used to log in.
 *
 * @example
 * ```ts
 * isUsableDiscordBotToken('placeholder'); // false
 * isUsableDiscordBotToken('real-token');  // true
 * ```
 */
export function isUsableDiscordBotToken(botToken: Maybe<DiscordBotToken>): boolean {
  return Boolean(botToken) && botToken !== DISCORD_BOT_TOKEN_PLACEHOLDER;
}

/**
 * Default gateway intents for a bot that reads guild messages.
 *
 * Includes Guilds, GuildMessages, and MessageContent.
 * Note: MessageContent is a privileged intent and must be enabled in the Discord Developer Portal.
 */
export const DEFAULT_DISCORD_INTENTS = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent];

export interface DiscordServiceApiConfig {
  /**
   * The bot token used to authenticate with the Discord gateway.
   */
  readonly botToken: DiscordBotToken;
  /**
   * discord.js Client options. Intents default to DEFAULT_DISCORD_INTENTS if not provided.
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
