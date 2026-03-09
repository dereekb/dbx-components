import { type GatewayIntentBits, type ClientOptions } from 'discord.js';
import { DISCORD_DEFAULT_INTENTS } from './discord.config';

/**
 * Returns default ClientOptions for a bot that reads guild messages.
 *
 * Includes Guilds, GuildMessages, and MessageContent intents.
 *
 * @example
 * ```ts
 * const options = discordDefaultClientOptions();
 * // options.intents === [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
 * ```
 */
export function discordDefaultClientOptions(): Partial<ClientOptions> {
  return {
    intents: DISCORD_DEFAULT_INTENTS
  };
}

/**
 * Returns ClientOptions with additional intents merged with the defaults.
 *
 * @param additionalIntents - extra intents to include beyond the defaults
 *
 * @example
 * ```ts
 * const options = discordClientOptionsWithIntents([GatewayIntentBits.DirectMessages]);
 * // options.intents includes Guilds, GuildMessages, MessageContent, and DirectMessages
 * ```
 */
export function discordClientOptionsWithIntents(additionalIntents: GatewayIntentBits[]): Partial<ClientOptions> {
  return {
    intents: [...DISCORD_DEFAULT_INTENTS, ...additionalIntents]
  };
}
