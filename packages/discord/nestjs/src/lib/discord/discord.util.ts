import { type APIMessage, type GatewayIntentBits, type ClientOptions } from 'discord.js';
import { DEFAULT_DISCORD_INTENTS } from './discord.config';
import { type DiscordApi } from './discord.api';
import { type DiscordChannelId, type DiscordFetchMessagePageFetchFunction, type DiscordMessagePageFilter } from '@dereekb/discord';

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

/**
 * Creates a {@link DiscordFetchMessagePageFetchFunction} bound to a single channel.
 *
 * This is the bridge between the `DiscordApi` REST client and the fetch-only scanning/pagination
 * utilities in `@dereekb/discord`, which take an injected fetch function and know nothing about
 * discord.js or a bot token.
 *
 * @param discordApi - The api to fetch messages through.
 * @param channelId - The channel to read messages from.
 * @returns A fetch function that pages through that channel's messages.
 *
 * @example
 * ```ts
 * const scan = discordScanMessagesFactory({
 *   fetch: discordApiChannelMessagesFetchFunction(discordApi, channelId)
 * });
 *
 * await scan({ baseInput: {}, afterMessageId, handleMessages });
 * ```
 */
export function discordApiChannelMessagesFetchFunction(discordApi: DiscordApi, channelId: DiscordChannelId): DiscordFetchMessagePageFetchFunction<DiscordMessagePageFilter, APIMessage> {
  return (input: DiscordMessagePageFilter) => discordApi.fetchChannelMessages({ ...input, channelId });
}
