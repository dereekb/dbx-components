import { type DiscordMessagePageFilter, type DiscordMessagePageResult } from './discord.api.page';
import { type DiscordScanMessagesResult, discordScanMessagesFactory } from './discord.api.scan';

/**
 * A real snowflake, so the ids used here exceed 53 bits like they do in production.
 */
const BASE_SNOWFLAKE = 1480401620608090182n;

interface TestMessage {
  readonly id: string;
  readonly content: string;
}

interface TestFetchInput extends DiscordMessagePageFilter {
  readonly channelId: string;
}

/**
 * Creates a channel's worth of messages, newest-first, with descending snowflake ids.
 */
function makeChannelMessages(count: number): TestMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    id: (BASE_SNOWFLAKE - BigInt(i)).toString(),
    content: `message-${i}`
  }));
}

/**
 * Creates a fetch function over the input messages that honors Discord's `before` + `limit` semantics.
 */
function makeTestFetch<T extends { id: string }>(messages: T[]) {
  const calls: TestFetchInput[] = [];

  async function fetch(input: TestFetchInput): Promise<DiscordMessagePageResult<T>> {
    calls.push(input);

    const before = input.before;
    const candidates = before == null ? messages : messages.filter((x) => BigInt(x.id) < BigInt(before));

    return { data: candidates.slice(0, input.limit ?? 100) };
  }

  return { fetch, calls };
}

/**
 * Collects every message handed to the handler, in delivery order.
 */
function makeCollector<T extends { id: string } = TestMessage>() {
  const handled: T[] = [];
  const batchSizes: number[] = [];

  async function handleMessages({ messages }: { messages: T[] }): Promise<void> {
    handled.push(...messages);
    batchSizes.push(messages.length);
  }

  return { handled, batchSizes, handleMessages };
}

describe('discordScanMessagesFactory()', () => {
  const channelId = '100000000000000000';

  describe('stop bound', () => {
    it('should stop mid-page at the afterMessageId bound and report complete', async () => {
      const messages = makeChannelMessages(30);
      const { fetch } = makeTestFetch(messages);
      const collector = makeCollector();

      const scan = discordScanMessagesFactory<TestFetchInput, TestMessage>({ fetch });

      const result = await scan({
        baseInput: { channelId },
        messagesPerPage: 10,
        afterMessageId: messages[15].id,
        handleMessages: collector.handleMessages
      });

      expect(result.stopReason).toBe('stop_bound');
      expect(result.complete).toBe(true);
      expect(result.newestMessageId).toBe(messages[0].id);
      expect(result.totalPages).toBe(2);
      expect(result.totalMessagesLoaded).toBe(20);
      expect(result.totalMessagesHandled).toBe(15);
      expect(collector.handled.map((x) => x.id)).toEqual(messages.slice(0, 15).map((x) => x.id));
    });

    it('should not deliver the stop bound message itself', async () => {
      const messages = makeChannelMessages(10);
      const { fetch } = makeTestFetch(messages);
      const collector = makeCollector();

      const scan = discordScanMessagesFactory<TestFetchInput, TestMessage>({ fetch });

      const result = await scan({
        baseInput: { channelId },
        messagesPerPage: 10,
        afterMessageId: messages[4].id,
        handleMessages: collector.handleMessages
      });

      expect(result.stopReason).toBe('stop_bound');
      expect(collector.handled.map((x) => x.id)).toEqual(messages.slice(0, 4).map((x) => x.id));
    });

    it('should handle nothing when already caught up', async () => {
      const messages = makeChannelMessages(10);
      const { fetch } = makeTestFetch(messages);
      const collector = makeCollector();

      const scan = discordScanMessagesFactory<TestFetchInput, TestMessage>({ fetch });

      const result = await scan({
        baseInput: { channelId },
        messagesPerPage: 10,
        afterMessageId: messages[0].id,
        handleMessages: collector.handleMessages
      });

      expect(result.stopReason).toBe('stop_bound');
      expect(result.complete).toBe(true);
      expect(result.totalMessagesHandled).toBe(0);
      expect(collector.batchSizes).toHaveLength(0); // never woken for an empty batch
      expect(result.newestMessageId).toBe(messages[0].id);
    });
  });

  describe('channel start', () => {
    it('should settle on a short final page', async () => {
      const messages = makeChannelMessages(25);
      const { fetch } = makeTestFetch(messages);
      const collector = makeCollector();

      const scan = discordScanMessagesFactory<TestFetchInput, TestMessage>({ fetch });

      const result = await scan({
        baseInput: { channelId },
        messagesPerPage: 10,
        handleMessages: collector.handleMessages
      });

      expect(result.stopReason).toBe('channel_start');
      expect(result.complete).toBe(true);
      expect(result.totalPages).toBe(3);
      expect(result.totalMessagesHandled).toBe(25);
      expect(collector.batchSizes).toEqual([10, 10, 5]);
      expect(collector.handled.map((x) => x.id)).toEqual(messages.map((x) => x.id));
    });

    it('should settle when the message count is an exact multiple of the page size', async () => {
      const messages = makeChannelMessages(20);
      const { fetch } = makeTestFetch(messages);
      const collector = makeCollector();

      const scan = discordScanMessagesFactory<TestFetchInput, TestMessage>({ fetch });

      const result = await scan({
        baseInput: { channelId },
        messagesPerPage: 10,
        handleMessages: collector.handleMessages
      });

      expect(result.stopReason).toBe('channel_start');
      expect(result.complete).toBe(true);
      expect(result.totalMessagesHandled).toBe(20);
      expect(collector.batchSizes).toEqual([10, 10]); // the trailing empty page never reaches the handler
    });

    it('should settle on an empty channel', async () => {
      const { fetch } = makeTestFetch([]);
      const collector = makeCollector();

      const scan = discordScanMessagesFactory<TestFetchInput, TestMessage>({ fetch });

      const result = await scan({
        baseInput: { channelId },
        messagesPerPage: 10,
        handleMessages: collector.handleMessages
      });

      expect(result.stopReason).toBe('channel_start');
      expect(result.complete).toBe(true);
      expect(result.newestMessageId).toBeUndefined();
      expect(result.resumeBeforeMessageId).toBeUndefined();
      expect(result.totalMessagesHandled).toBe(0);
    });

    it('should request the same limit on every page', async () => {
      const messages = makeChannelMessages(25);
      const { fetch, calls } = makeTestFetch(messages);
      const collector = makeCollector();

      const scan = discordScanMessagesFactory<TestFetchInput, TestMessage>({ fetch });

      await scan({
        baseInput: { channelId },
        messagesPerPage: 10,
        handleMessages: collector.handleMessages
      });

      expect(calls).toHaveLength(3);
      expect(calls.map((x) => x.limit)).toEqual([10, 10, 10]);
      expect(calls.map((x) => x.channelId)).toEqual([channelId, channelId, channelId]);
      expect(calls[0].before).toBeUndefined();
      expect(calls[1].before).toBe(messages[9].id);
      expect(calls[2].before).toBe(messages[19].id);
    });
  });

  describe('budgets', () => {
    /**
     * Resumes a scan until it reports complete, returning every message handled across all runs.
     */
    async function scanToCompletion(messages: TestMessage[], scanOptions: { readonly messagesPerPage: number; readonly maxMessages?: number; readonly maxPages?: number }) {
      const { fetch } = makeTestFetch(messages);
      const collector = makeCollector();
      const scan = discordScanMessagesFactory<TestFetchInput, TestMessage>({ fetch });

      const results: DiscordScanMessagesResult[] = [];
      let beforeMessageId: string | undefined;
      let result: DiscordScanMessagesResult;

      do {
        result = await scan({
          baseInput: { channelId },
          ...scanOptions,
          beforeMessageId,
          handleMessages: collector.handleMessages
        });

        results.push(result);
        beforeMessageId = result.resumeBeforeMessageId ?? undefined;
      } while (!result.complete && results.length < 20);

      return { results, handled: collector.handled };
    }

    describe('maxMessages', () => {
      it('should stop once the message budget is spent', async () => {
        const messages = makeChannelMessages(25);
        const { fetch } = makeTestFetch(messages);
        const collector = makeCollector();

        const scan = discordScanMessagesFactory<TestFetchInput, TestMessage>({ fetch });

        const result = await scan({
          baseInput: { channelId },
          messagesPerPage: 10,
          maxMessages: 10,
          handleMessages: collector.handleMessages
        });

        expect(result.stopReason).toBe('max_messages');
        expect(result.complete).toBe(false);
        expect(result.totalPages).toBe(1);
        expect(result.resumeBeforeMessageId).toBe(messages[9].id);
        expect(collector.handled.map((x) => x.id)).toEqual(messages.slice(0, 10).map((x) => x.id));
      });

      it('should resume with zero gaps and zero duplicates', async () => {
        const messages = makeChannelMessages(25);
        const { results, handled } = await scanToCompletion(messages, { messagesPerPage: 10, maxMessages: 10 });

        expect(results.map((x) => x.stopReason)).toEqual(['max_messages', 'max_messages', 'channel_start']);
        expect(handled.map((x) => x.id)).toEqual(messages.map((x) => x.id));
        expect(new Set(handled.map((x) => x.id)).size).toBe(messages.length);
      });
    });

    describe('maxPages', () => {
      it('should stop once the page budget is spent', async () => {
        const messages = makeChannelMessages(25);
        const { fetch } = makeTestFetch(messages);
        const collector = makeCollector();

        const scan = discordScanMessagesFactory<TestFetchInput, TestMessage>({ fetch });

        const result = await scan({
          baseInput: { channelId },
          messagesPerPage: 10,
          maxPages: 2,
          handleMessages: collector.handleMessages
        });

        expect(result.stopReason).toBe('max_pages');
        expect(result.complete).toBe(false);
        expect(result.totalPages).toBe(2);
        expect(result.resumeBeforeMessageId).toBe(messages[19].id);
      });

      it('should resume with zero gaps and zero duplicates', async () => {
        const messages = makeChannelMessages(25);
        const { results, handled } = await scanToCompletion(messages, { messagesPerPage: 10, maxPages: 1 });

        expect(results.map((x) => x.stopReason)).toEqual(['max_pages', 'max_pages', 'channel_start']);
        expect(handled.map((x) => x.id)).toEqual(messages.map((x) => x.id));
        expect(new Set(handled.map((x) => x.id)).size).toBe(messages.length);
      });
    });

    describe('maxDuration', () => {
      it('should stop once the time budget is spent', async () => {
        const messages = makeChannelMessages(50);
        const { fetch } = makeTestFetch(messages);
        const collector = makeCollector();

        let now = 0;

        const scan = discordScanMessagesFactory<TestFetchInput, TestMessage>({
          fetch,
          nowFactory: () => new Date(now)
        });

        const result = await scan({
          baseInput: { channelId },
          messagesPerPage: 10,
          maxDuration: 1000,
          handleMessages: async (batch) => {
            now += 600; // each page costs more than half the budget
            await collector.handleMessages(batch);
          }
        });

        expect(result.stopReason).toBe('time_budget');
        expect(result.complete).toBe(false);
        expect(result.totalPages).toBe(2);
        expect(result.resumeBeforeMessageId).toBe(messages[19].id);
        expect(result.startedAt.getTime()).toBe(0);
        expect(result.endedAt.getTime()).toBe(1200);
      });

      it('should resume from where the time budget ran out', async () => {
        const messages = makeChannelMessages(30);
        const { fetch } = makeTestFetch(messages);
        const collector = makeCollector();

        let now = 0;

        const scan = discordScanMessagesFactory<TestFetchInput, TestMessage>({
          fetch,
          nowFactory: () => new Date(now)
        });

        const firstResult = await scan({
          baseInput: { channelId },
          messagesPerPage: 10,
          maxDuration: 1000,
          handleMessages: async (batch) => {
            now += 600;
            await collector.handleMessages(batch);
          }
        });

        now = 0;

        const secondResult = await scan({
          baseInput: { channelId },
          messagesPerPage: 10,
          beforeMessageId: firstResult.resumeBeforeMessageId,
          handleMessages: collector.handleMessages
        });

        expect(firstResult.complete).toBe(false);
        expect(secondResult.complete).toBe(true);
        expect(collector.handled.map((x) => x.id)).toEqual(messages.map((x) => x.id));
      });
    });
  });

  describe('filterMessages', () => {
    it('should keep the resume cursor on the oldest LOADED message, not the oldest delivered', async () => {
      const messages = makeChannelMessages(20);
      const { fetch } = makeTestFetch(messages);
      const collector = makeCollector();

      const scan = discordScanMessagesFactory<TestFetchInput, TestMessage>({ fetch });

      const result = await scan({
        baseInput: { channelId },
        messagesPerPage: 10,
        maxPages: 1,
        filterMessages: (pageMessages) => pageMessages.slice(0, 7), // drop the tail of the page
        handleMessages: collector.handleMessages
      });

      expect(result.stopReason).toBe('max_pages');
      expect(result.resumeBeforeMessageId).toBe(messages[9].id);
      expect(result.resumeBeforeMessageId).not.toBe(messages[6].id);
      expect(result.totalMessagesLoaded).toBe(10);
      expect(result.totalMessagesHandled).toBe(7);
      expect(collector.handled.map((x) => x.id)).toEqual(messages.slice(0, 7).map((x) => x.id));
    });

    it('should keep the high water mark on the newest LOADED message', async () => {
      const messages = makeChannelMessages(10);
      const { fetch } = makeTestFetch(messages);
      const collector = makeCollector();

      const scan = discordScanMessagesFactory<TestFetchInput, TestMessage>({ fetch });

      const result = await scan({
        baseInput: { channelId },
        messagesPerPage: 10,
        filterMessages: (pageMessages) => pageMessages.slice(3), // drop the newest messages
        handleMessages: collector.handleMessages
      });

      expect(result.newestMessageId).toBe(messages[0].id);
      expect(result.totalMessagesHandled).toBe(7);
    });

    it('should not wake the handler for a page that filters down to nothing', async () => {
      const messages = makeChannelMessages(25);
      const { fetch } = makeTestFetch(messages);
      const collector = makeCollector();

      const scan = discordScanMessagesFactory<TestFetchInput, TestMessage>({ fetch });

      const result = await scan({
        baseInput: { channelId },
        messagesPerPage: 10,
        filterMessages: (pageMessages) => (pageMessages[0].id === messages[10].id ? [] : pageMessages), // drop the whole second page
        handleMessages: collector.handleMessages
      });

      expect(result.complete).toBe(true);
      expect(collector.batchSizes).toEqual([10, 5]);
      expect(result.totalMessagesLoaded).toBe(25);
      expect(result.totalMessagesHandled).toBe(15);
    });

    it('should support an async filter', async () => {
      const messages = makeChannelMessages(10);
      const { fetch } = makeTestFetch(messages);
      const collector = makeCollector();

      const scan = discordScanMessagesFactory<TestFetchInput, TestMessage>({ fetch });

      const result = await scan({
        baseInput: { channelId },
        messagesPerPage: 10,
        filterMessages: async (pageMessages) => pageMessages.filter((_, i) => i % 2 === 0),
        handleMessages: collector.handleMessages
      });

      expect(result.totalMessagesHandled).toBe(5);
      expect(collector.handled.map((x) => x.id)).toEqual([messages[0].id, messages[2].id, messages[4].id, messages[6].id, messages[8].id]);
    });
  });

  describe('batch', () => {
    it('should describe each batch it delivers', async () => {
      const messages = makeChannelMessages(25);
      const { fetch } = makeTestFetch(messages);

      const batches: { page: number; newestMessageId: string; oldestMessageId: string; totalMessagesHandled: number }[] = [];

      const scan = discordScanMessagesFactory<TestFetchInput, TestMessage>({ fetch });

      await scan({
        baseInput: { channelId },
        messagesPerPage: 10,
        handleMessages: async ({ page, newestMessageId, oldestMessageId, totalMessagesHandled }) => {
          batches.push({ page, newestMessageId, oldestMessageId, totalMessagesHandled });
        }
      });

      expect(batches).toEqual([
        { page: 0, newestMessageId: messages[0].id, oldestMessageId: messages[9].id, totalMessagesHandled: 10 },
        { page: 1, newestMessageId: messages[10].id, oldestMessageId: messages[19].id, totalMessagesHandled: 20 },
        { page: 2, newestMessageId: messages[20].id, oldestMessageId: messages[24].id, totalMessagesHandled: 25 }
      ]);
    });

    it('should propagate an error thrown by the handler', async () => {
      const messages = makeChannelMessages(25);
      const { fetch } = makeTestFetch(messages);

      const scan = discordScanMessagesFactory<TestFetchInput, TestMessage>({ fetch });

      await expect(
        scan({
          baseInput: { channelId },
          messagesPerPage: 10,
          handleMessages: async () => {
            throw new Error('handler failure');
          }
        })
      ).rejects.toThrow('handler failure');
    });
  });

  describe('defaults', () => {
    it('should use the factory defaults when the scan input omits a bound', async () => {
      const messages = makeChannelMessages(25);
      const { fetch, calls } = makeTestFetch(messages);
      const collector = makeCollector();

      const scan = discordScanMessagesFactory<TestFetchInput, TestMessage>({
        fetch,
        defaults: { messagesPerPage: 10, maxPages: 1 }
      });

      const result = await scan({
        baseInput: { channelId },
        handleMessages: collector.handleMessages
      });

      expect(calls[0].limit).toBe(10);
      expect(result.stopReason).toBe('max_pages');
      expect(result.totalMessagesHandled).toBe(10);
    });

    it('should let the scan input override the factory defaults', async () => {
      const messages = makeChannelMessages(25);
      const { fetch, calls } = makeTestFetch(messages);
      const collector = makeCollector();

      const scan = discordScanMessagesFactory<TestFetchInput, TestMessage>({
        fetch,
        defaults: { messagesPerPage: 10, maxPages: 1 }
      });

      const result = await scan({
        baseInput: { channelId },
        messagesPerPage: 25,
        maxPages: 5,
        handleMessages: collector.handleMessages
      });

      expect(calls[0].limit).toBe(25);
      expect(result.stopReason).toBe('channel_start');
      expect(result.totalMessagesHandled).toBe(25);
    });
  });

  describe('readMessageId', () => {
    it('should use the configured message id reader', async () => {
      const messages = makeChannelMessages(5).map((x) => ({ ...x, messageId: x.id }));
      const { fetch } = makeTestFetch(messages);
      const collector = makeCollector<(typeof messages)[0]>();

      const scan = discordScanMessagesFactory<TestFetchInput, (typeof messages)[0]>({
        fetch,
        readMessageId: (message) => message.messageId
      });

      const result = await scan({
        baseInput: { channelId },
        messagesPerPage: 10,
        handleMessages: collector.handleMessages
      });

      expect(result.newestMessageId).toBe(messages[0].messageId);
      expect(result.totalMessagesHandled).toBe(5);
    });
  });
});
