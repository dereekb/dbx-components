import { type GatewayIntentBits, type ClientOptions } from 'discord.js';
import { DEFAULT_DISCORD_INTENTS } from './discord.config';

/**
 * Returns default ClientOptions for a bot that reads guild messages.
 *
 * Includes Guilds, GuildMessages, and MessageContent intents.
 *
 * @returns Partial ClientOptions with the default bot intents set.
 *
 * @example
 * ```ts
 * const options = discordDefaultClientOptions();
 * // options.intents === [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
 * ```
 */
export function discordDefaultClientOptions(): Partial<ClientOptions> {
  return {
    intents: DEFAULT_DISCORD_INTENTS
  };
}

/**
 * Returns ClientOptions with additional intents merged with the defaults.
 *
 * @param additionalIntents - Extra intents to include beyond the defaults.
 * @returns Partial ClientOptions with the merged intent list.
 *
 * @example
 * ```ts
 * const options = discordClientOptionsWithIntents([GatewayIntentBits.DirectMessages]);
 * // options.intents includes Guilds, GuildMessages, MessageContent, and DirectMessages
 * ```
 */
export function discordClientOptionsWithIntents(additionalIntents: GatewayIntentBits[]): Partial<ClientOptions> {
  return {
    intents: [...DEFAULT_DISCORD_INTENTS, ...additionalIntents]
  };
}
