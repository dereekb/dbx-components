import { type APIMessage, GatewayIntentBits } from 'discord.js';
import { discordDefaultClientOptions, discordClientOptionsWithIntents, discordApiChannelMessagesFetchFunction } from './discord.util';
import { DEFAULT_DISCORD_INTENTS } from './discord.config';
import { type DiscordApi, type DiscordFetchChannelMessagesInput } from './discord.api';
import { discordScanMessagesFactory } from '@dereekb/discord';

describe('discordDefaultClientOptions()', () => {
  it('should return options with the default intents', () => {
    const options = discordDefaultClientOptions();

    expect(options.intents).toBeDefined();
    expect(options.intents).toEqual(DEFAULT_DISCORD_INTENTS);
  });
});

describe('discordClientOptionsWithIntents()', () => {
  it('should return options with defaults plus additional intents', () => {
    const additional = [GatewayIntentBits.DirectMessages];
    const options = discordClientOptionsWithIntents(additional);

    expect(options.intents).toBeDefined();
    expect(options.intents).toEqual([...DEFAULT_DISCORD_INTENTS, GatewayIntentBits.DirectMessages]);
  });

  it('should return only defaults when given an empty array', () => {
    const options = discordClientOptionsWithIntents([]);

    expect(options.intents).toEqual(DEFAULT_DISCORD_INTENTS);
  });
});

describe('discordApiChannelMessagesFetchFunction()', () => {
  const channelId = '200000000000000000';

  function makeFakeDiscordApi(pages: APIMessage[][]) {
    const calls: DiscordFetchChannelMessagesInput[] = [];
    let callIndex = 0;

    const discordApi = {
      fetchChannelMessages: async (input: DiscordFetchChannelMessagesInput) => {
        calls.push(input);
        const data = pages[callIndex] ?? [];
        callIndex += 1;
        return { data };
      }
    } as unknown as DiscordApi;

    return { discordApi, calls };
  }

  function makeApiMessages(count: number, startId: bigint): APIMessage[] {
    return Array.from({ length: count }, (_, i) => ({ id: (startId - BigInt(i)).toString(), content: `message-${i}` }) as unknown as APIMessage);
  }

  it('should bind the channel id into every fetch', async () => {
    const { discordApi, calls } = makeFakeDiscordApi([[]]);
    const fetch = discordApiChannelMessagesFetchFunction(discordApi, channelId);

    await fetch({ before: '1480401620608090182', limit: 10 });

    expect(calls).toEqual([{ channelId, before: '1480401620608090182', limit: 10 }]);
  });

  it('should drive a message scan', async () => {
    const firstPage = makeApiMessages(10, 1480401620608090182n);
    const secondPage = makeApiMessages(4, 1480401620608090172n);

    const { discordApi, calls } = makeFakeDiscordApi([firstPage, secondPage]);
    const scan = discordScanMessagesFactory({ fetch: discordApiChannelMessagesFetchFunction(discordApi, channelId) });

    const handled: APIMessage[] = [];

    const result = await scan({
      baseInput: {},
      messagesPerPage: 10,
      handleMessages: async ({ messages }) => {
        handled.push(...messages);
      }
    });

    expect(result.stopReason).toBe('channel_start');
    expect(result.complete).toBe(true);
    expect(result.totalMessagesHandled).toBe(14);
    expect(handled.map((x) => x.id)).toEqual([...firstPage, ...secondPage].map((x) => x.id));
    expect(calls.map((x) => x.channelId)).toEqual([channelId, channelId]);
    expect(calls[1].before).toBe(firstPage[9].id);
  });
});
