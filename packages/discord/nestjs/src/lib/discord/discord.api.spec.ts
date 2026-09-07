import { DiscordApi } from './discord.api';
import { getSharedDiscordTestClient } from './discord.api.spec.client';
import { type APIMessage, type Message, REST, Routes } from 'discord.js';
import { DISCORD_BOT_TOKEN_PLACEHOLDER, type DiscordServiceConfig } from './discord.config';

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

  describe('fetchChannelMessages()', () => {
    it('should fetch a page of messages from the channel', async () => {
      const content = `fetchChannelMessages test — ${new Date().toISOString()}`;
      await discordApi.sendMessage(testChannelId, content);

      const page = await discordApi.fetchChannelMessages({ channelId: testChannelId, limit: 10 });

      expect(page.data.length).toBeGreaterThan(0);
      expect(page.data[0].id).toBeDefined();
      // doubles as a MESSAGE_CONTENT privileged-intent check: without it every content is empty
      expect(page.data[0].content).not.toBe('');
    }, 15000);
  });
});

/**
 * Fixture shaped like the raw REST payload Discord returns for a channel messages request.
 */
function makeApiMessageFixture(id: string, content: string): APIMessage {
  return {
    id,
    channel_id: '200000000000000000',
    author: { id: '300000000000000000', username: 'tester', discriminator: '0', global_name: null, avatar: null },
    content,
    timestamp: '2026-03-09T03:07:30.885Z',
    edited_timestamp: null,
    tts: false,
    mention_everyone: false,
    mentions: [],
    mention_roles: [],
    attachments: [],
    embeds: [],
    pinned: false,
    type: 0
  } as unknown as APIMessage;
}

function makeTestDiscordApi(botToken: string): DiscordApi {
  const config: DiscordServiceConfig = {
    discord: {
      botToken,
      autoLogin: false
    }
  };

  return new DiscordApi(config);
}

describe('DiscordApi.fetchChannelMessages()', () => {
  const channelId = '200000000000000000';

  let discordApi: DiscordApi;

  beforeEach(() => {
    discordApi = makeTestDiscordApi(DISCORD_BOT_TOKEN_PLACEHOLDER);
  });

  afterEach(async () => {
    await discordApi.client.destroy();
  });

  it('should return the raw REST payload as the page data', async () => {
    const fixture = [makeApiMessageFixture('1480401620608090182', 'hello'), makeApiMessageFixture('1480401620608090181', 'world')];
    const get = vi.spyOn(discordApi.client.rest, 'get').mockResolvedValue(fixture);

    const page = await discordApi.fetchChannelMessages({ channelId, limit: 2 });

    expect(page.data).toBe(fixture);
    expect(page.data[0].content).toBe('hello');
    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0][0]).toBe(Routes.channelMessages(channelId));
  });

  it('should send only the pagination values that were provided', async () => {
    const get = vi.spyOn(discordApi.client.rest, 'get').mockResolvedValue([]);

    await discordApi.fetchChannelMessages({ channelId, before: '1480401620608090182', limit: 50 });

    const query = get.mock.calls[0][1]?.query as URLSearchParams;

    expect(query.get('before')).toBe('1480401620608090182');
    expect(query.get('limit')).toBe('50');
    expect(query.has('after')).toBe(false);
    expect(query.has('around')).toBe(false);
  });

  it('should send every pagination value that was provided', async () => {
    const get = vi.spyOn(discordApi.client.rest, 'get').mockResolvedValue([]);

    await discordApi.fetchChannelMessages({ channelId, before: '3', after: '1', around: '2', limit: 10 });

    const query = get.mock.calls[0][1]?.query as URLSearchParams;

    expect(query.get('before')).toBe('3');
    expect(query.get('after')).toBe('1');
    expect(query.get('around')).toBe('2');
    expect(query.get('limit')).toBe('10');
  });

  it('should return an empty page when the channel has no messages', async () => {
    vi.spyOn(discordApi.client.rest, 'get').mockResolvedValue([]);

    const page = await discordApi.fetchChannelMessages({ channelId });

    expect(page.data).toEqual([]);
  });
});

describe('DiscordApi REST token', () => {
  it('should set the REST token when the bot token is usable', () => {
    const setToken = vi.spyOn(REST.prototype, 'setToken');
    const botToken = 'a-real-looking-bot-token';

    const discordApi = makeTestDiscordApi(botToken);

    expect(setToken).toHaveBeenCalledWith(botToken);

    setToken.mockRestore();
    void discordApi.client.destroy();
  });

  it('should not set the REST token for the placeholder token', () => {
    const setToken = vi.spyOn(REST.prototype, 'setToken');

    const discordApi = makeTestDiscordApi(DISCORD_BOT_TOKEN_PLACEHOLDER);

    expect(setToken).not.toHaveBeenCalled();

    setToken.mockRestore();
    void discordApi.client.destroy();
  });
});
