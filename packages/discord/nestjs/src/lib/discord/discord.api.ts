import { type APIMessage, Client, Events, Routes, TextChannel, type Message } from 'discord.js';
import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { DiscordServiceConfig, DEFAULT_DISCORD_INTENTS, isUsableDiscordBotToken } from './discord.config';
import { type DiscordChannelId, type DiscordMessagePageFilter, type DiscordMessagePageResult } from '@dereekb/discord';

/**
 * Input for {@link DiscordApi.fetchChannelMessages}.
 *
 * Extends the shared pagination filter with the channel to read from.
 */
export interface DiscordFetchChannelMessagesInput extends DiscordMessagePageFilter {
  /**
   * The channel to read messages from.
   */
  readonly channelId: DiscordChannelId;
}

/**
 * Injectable service that wraps the discord.js Client for bot operations.
 *
 * Automatically logs in on module init and destroys the client on module destroy
 * when autoLogin is enabled (default).
 */
@Injectable()
export class DiscordApi implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('DiscordApi');

  /**
   * The underlying discord.js Client instance.
   */
  readonly client: Client;

  constructor(@Inject(DiscordServiceConfig) readonly config: DiscordServiceConfig) {
    const { botToken, clientOptions } = config.discord;
    this.client = new Client({
      intents: DEFAULT_DISCORD_INTENTS,
      ...clientOptions
    });

    // login() is the only other thing that sets the REST token, so without this the REST client is
    // unusable when autoLogin is false. Setting it here is what lets a consumer use the REST API
    // (fetchChannelMessages, for instance) without opening a gateway websocket.
    if (isUsableDiscordBotToken(botToken)) {
      this.client.rest.setToken(botToken);
    }
  }

  async onModuleInit(): Promise<void> {
    const { autoLogin = true, botToken } = this.config.discord;

    let result: Promise<void>;

    if (autoLogin) {
      result = this.client
        .login(botToken)
        .then(() => undefined)
        .catch((e) => {
          this.logger.error('Failed to log in to Discord', e);
        });
    } else {
      result = Promise.resolve();
    }

    return result;
  }

  async onModuleDestroy(): Promise<void> {
    return this.client.destroy();
  }

  /**
   * Sends a text message to a Discord channel.
   *
   * @param channelId - target channel's snowflake ID
   * @param content - message text to send
   *
   * @throws {Error} When the channel is not found or is not a text channel.
   *
   * @example
   * ```ts
   * const message = await discordApi.sendMessage('123456789', 'Hello from the bot!');
   * ```
   */
  /**
   * Sends a text message to the specified Discord channel.
   *
   * @param channelId - Target channel's snowflake ID.
   * @param content - Message text to send.
   * @returns The sent Discord Message.
   * @throws {Error} When the channel is not found or is not a text channel.
   */
  async sendMessage(channelId: DiscordChannelId, content: string): Promise<Message> {
    const channel = await this.client.channels.fetch(channelId);

    if (!channel || !(channel instanceof TextChannel)) {
      throw new Error(`Channel ${channelId} not found or is not a text channel.`);
    }

    return channel.send(content);
  }

  /**
   * Registers a handler for the MessageCreate event (incoming messages).
   *
   * Returns an unsubscribe function to remove the handler.
   *
   * @param handler - callback invoked for each incoming message
   *
   * @example
   * ```ts
   * const unsubscribe = discordApi.onMessage((message) => {
   *   if (!message.author.bot) {
   *     console.log(`${message.author.tag}: ${message.content}`);
   *   }
   * });
   *
   * // Later, to stop listening:
   * unsubscribe();
   * ```
   */
  /**
   * Registers a handler for incoming Discord messages (MessageCreate event).
   *
   * @param handler - Callback invoked for each incoming Message.
   * @returns An unsubscribe function that removes the registered handler.
   */
  onMessage(handler: (message: Message) => void): () => void {
    this.client.on(Events.MessageCreate, handler);
    return () => this.client.off(Events.MessageCreate, handler);
  }

  /**
   * Fetches a page of a channel's message history.
   *
   * Goes through the REST client rather than `client.channels.fetch(...).messages.fetch(...)` for
   * three reasons: it needs no gateway session (only a token), `@discordjs/rest` already applies
   * Discord's per-route bucket rate limiting and 429 retries, and the returned `APIMessage` is plain
   * JSON rather than a discord.js `Message` carrying a live client back-reference.
   *
   * Pair with `discordScanMessagesFactory` from `@dereekb/discord` to walk a channel's history.
   *
   * @param input - The channel to read and the pagination filter to read it with.
   * @returns The page of messages, newest-first.
   *
   * @example
   * ```ts
   * const page = await discordApi.fetchChannelMessages({ channelId, limit: 50 });
   * ```
   */
  async fetchChannelMessages(input: DiscordFetchChannelMessagesInput): Promise<DiscordMessagePageResult<APIMessage>> {
    const { channelId, before, after, around, limit } = input;
    const query = new URLSearchParams();

    if (before) {
      query.set('before', before);
    }

    if (after) {
      query.set('after', after);
    }

    if (around) {
      query.set('around', around);
    }

    if (limit != null) {
      query.set('limit', String(limit));
    }

    const data = (await this.client.rest.get(Routes.channelMessages(channelId), { query })) as APIMessage[];
    return { data };
  }
}
