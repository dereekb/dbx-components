import { type DiscordApi } from './discord.api';
import { getSharedDiscordTestClient } from './discord.api.spec.client';
import { type Message } from 'discord.js';

// Integration tests hit the live Discord gateway and consume a daily session quota.
// They only run when explicitly opted into via DISCORD_RUN_INTEGRATION_TESTS=true.
const integrationTestsEnabled = process.env['DISCORD_RUN_INTEGRATION_TESTS'] === 'true';

describe.runIf(integrationTestsEnabled)('DiscordApi', () => {
  let discordApi: DiscordApi;
  let testChannelId: string;

  beforeAll(async () => {
    const shared = await getSharedDiscordTestClient();
    discordApi = shared.discordApi;
    testChannelId = shared.testChannelId;
  }, 15000);

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
