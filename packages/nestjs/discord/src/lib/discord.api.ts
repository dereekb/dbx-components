import { Client, Events, TextChannel, type Message } from 'discord.js';
import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { DiscordServiceConfig, DISCORD_DEFAULT_INTENTS } from './discord.config';
import { type DiscordChannelId } from './discord.type';

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
    const { clientOptions } = config.discord;
    this.client = new Client({
      intents: DISCORD_DEFAULT_INTENTS,
      ...clientOptions
    });
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
   * @param channelId - target channel's snowflake ID
   * @param content - message text to send
   * @returns the sent Discord Message
   * @throws {Error} when the channel is not found or is not a text channel
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
   * @param handler - callback invoked for each incoming Message
   * @returns an unsubscribe function that removes the registered handler
   */
  onMessage(handler: (message: Message) => void): () => void {
    this.client.on(Events.MessageCreate, handler);
    return () => this.client.off(Events.MessageCreate, handler);
  }
}
