import { DiscordApi } from './discord.api';
import { type DiscordServiceConfig } from './discord.config';
import { Events, type Message, type TextChannel, ChannelType } from 'discord.js';

// provided in environment variables
const botToken = process.env['DISCORD_BOT_TOKEN'] as string;
const envChannelId = process.env['DISCORD_TEST_CHANNEL_ID'];

describe('DiscordApi', () => {
  let discordApi: DiscordApi;
  let testChannelId: string;

  beforeAll(async () => {
    const config: DiscordServiceConfig = {
      discord: {
        botToken,
        autoLogin: false
      }
    };

    discordApi = new DiscordApi(config);
    await discordApi.client.login(botToken);

    // wait for the client to be ready
    await new Promise<void>((resolve) => {
      if (discordApi.client.isReady()) {
        resolve();
      } else {
        discordApi.client.once(Events.ClientReady, () => resolve());
      }
    });

    // use env var if provided, otherwise auto-discover from bot's guilds
    if (envChannelId) {
      testChannelId = envChannelId;
    } else {
      const guild = discordApi.client.guilds.cache.first();

      if (!guild) {
        throw new Error('Bot is not in any guilds. Invite the bot to a server first (see SETUP.md).');
      }

      const channels = await guild.channels.fetch();
      const textChannel = channels.find((ch): ch is TextChannel => ch !== null && ch.type === ChannelType.GuildText);

      if (!textChannel) {
        throw new Error(`No text channels found in guild "${guild.name}".`);
      }

      testChannelId = textChannel.id;
    }
  }, 15000);

  afterAll(async () => {
    void discordApi.client.destroy();
  });

  describe('sendMessage()', () => {
    it('should send a text message to a channel', async () => {
      const content = `test message — ${new Date().toISOString()}`;
      const message = await discordApi.sendMessage(testChannelId, content);

      expect(message).toBeDefined();
      expect(message.content).toBe(content);
      expect(message.channelId).toBe(testChannelId);
      expect(message.author.id).toBe(discordApi.client.user?.id);
    });

    it('should throw when the channel does not exist', async () => {
      await expect(discordApi.sendMessage('000000000000000000', 'test')).rejects.toThrow();
    });
  });

  describe('onMessage()', () => {
    it('should receive a message sent by the bot itself', async () => {
      const content = `onMessage test — ${new Date().toISOString()}`;

      const receivedMessage = await new Promise<Message>((resolve, reject) => {
        const timeout = setTimeout(() => {
          unsubscribe();
          reject(new Error('Timed out waiting for message'));
        }, 10000);

        const unsubscribe = discordApi.onMessage((message) => {
          if (message.content === content) {
            clearTimeout(timeout);
            unsubscribe();
            resolve(message);
          }
        });

        // send the message after subscribing
        discordApi.sendMessage(testChannelId, content).catch(reject);
      });

      expect(receivedMessage).toBeDefined();
      expect(receivedMessage.content).toBe(content);
      expect(receivedMessage.author.id).toBe(discordApi.client.user?.id);
    }, 15000);
  });
});
