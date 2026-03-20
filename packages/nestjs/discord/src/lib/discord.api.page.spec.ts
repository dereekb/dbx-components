import { discordFetchMessagePageFactory, type DiscordMessagePageFilter, type DiscordMessagePageResult, DISCORD_DEFAULT_MESSAGES_PER_PAGE } from './discord.api.page';

interface TestMessage {
  id: string;
  content: string;
}

function makeMessages(count: number, startId: number = 100): TestMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    id: String(startId - i),
    content: `message-${startId - i}`
  }));
}

describe('discordFetchMessagePageFactory()', () => {
  it('should fetch a single page when fewer results than limit are returned', async () => {
    const messages = makeMessages(5);

    const fetch = vi.fn(
      async (_input: DiscordMessagePageFilter): Promise<DiscordMessagePageResult<TestMessage>> => ({
        data: messages
      })
    );

    const factory = discordFetchMessagePageFactory({ fetch });
    const page = factory({ limit: 10 });
    const firstPage = await page.fetchNext();

    expect(firstPage.result.data).toEqual(messages);
    expect(firstPage.hasNext).toBe(true); // hasNext is true because data.length > 0
    expect(fetch).toHaveBeenCalledTimes(1);

    // next page should signal no more results since buildInputForNextPage returns undefined
    await expect(firstPage.fetchNext()).rejects.toThrow();
  });

  it('should paginate through multiple pages using before cursor', async () => {
    const page1Messages = makeMessages(10, 100);
    const page2Messages = makeMessages(10, 90);
    const page3Messages = makeMessages(3, 80);

    let callCount = 0;

    const fetch = vi.fn(async (_input: DiscordMessagePageFilter): Promise<DiscordMessagePageResult<TestMessage>> => {
      callCount++;

      switch (callCount) {
        case 1:
          return { data: page1Messages };
        case 2:
          return { data: page2Messages };
        case 3:
          return { data: page3Messages };
        default:
          return { data: [] };
      }
    });

    const factory = discordFetchMessagePageFactory({ fetch });
    const page = factory({ limit: 10 });

    const firstPage = await page.fetchNext();
    expect(firstPage.result.data).toEqual(page1Messages);
    expect(fetch).toHaveBeenCalledWith(expect.objectContaining({ limit: 10 }));

    const secondPage = await firstPage.fetchNext();
    expect(secondPage.result.data).toEqual(page2Messages);
    expect(fetch).toHaveBeenLastCalledWith(expect.objectContaining({ before: '91', limit: 10 }));

    const thirdPage = await secondPage.fetchNext();
    expect(thirdPage.result.data).toEqual(page3Messages);
    expect(fetch).toHaveBeenLastCalledWith(expect.objectContaining({ before: '81', limit: 10 }));

    // third page had fewer than limit, so no more pages
    await expect(thirdPage.fetchNext()).rejects.toThrow();
  });

  it('should clear after and around when paginating forward with before', async () => {
    const messages = makeMessages(10, 100);

    const fetch = vi.fn(
      async (_input: DiscordMessagePageFilter): Promise<DiscordMessagePageResult<TestMessage>> => ({
        data: messages
      })
    );

    const factory = discordFetchMessagePageFactory({ fetch });
    const page = factory({ after: '50', limit: 10 });

    const firstPage = await page.fetchNext();
    expect(fetch).toHaveBeenCalledWith(expect.objectContaining({ after: '50' }));

    // trigger second page fetch - it should use before cursor, not after
    await firstPage.fetchNext();
    expect(fetch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        before: '91',
        after: undefined,
        around: undefined
      })
    );
  });

  it('should use custom readMessageId when provided', async () => {
    interface CustomMessage {
      id: string;
      snowflake: string;
    }

    const messages: CustomMessage[] = [
      { id: '1', snowflake: 'sf-100' },
      { id: '2', snowflake: 'sf-99' }
    ];

    const fetch = vi.fn(
      async (_input: DiscordMessagePageFilter): Promise<DiscordMessagePageResult<CustomMessage>> => ({
        data: messages
      })
    );

    const factory = discordFetchMessagePageFactory({
      fetch,
      config: { readMessageId: (msg) => msg.snowflake }
    });

    const page = factory({ limit: 2 });
    const firstPage = await page.fetchNext();
    await firstPage.fetchNext();

    expect(fetch).toHaveBeenLastCalledWith(expect.objectContaining({ before: 'sf-99' }));
  });

  it('should handle empty results', async () => {
    const fetch = vi.fn(
      async (_input: DiscordMessagePageFilter): Promise<DiscordMessagePageResult<TestMessage>> => ({
        data: []
      })
    );

    const factory = discordFetchMessagePageFactory({ fetch });
    const page = factory({ limit: 10 });
    const firstPage = await page.fetchNext();

    expect(firstPage.result.data).toEqual([]);
    await expect(firstPage.fetchNext()).rejects.toThrow();
  });

  it('should use DISCORD_DEFAULT_MESSAGES_PER_PAGE when no limit is specified', async () => {
    const messages = makeMessages(DISCORD_DEFAULT_MESSAGES_PER_PAGE, 200);

    const fetch = vi.fn(
      async (_input: DiscordMessagePageFilter): Promise<DiscordMessagePageResult<TestMessage>> => ({
        data: messages
      })
    );

    const factory = discordFetchMessagePageFactory({ fetch });
    const page = factory({});

    const firstPage = await page.fetchNext();
    expect(firstPage.result.data.length).toBe(DISCORD_DEFAULT_MESSAGES_PER_PAGE);

    // should continue since we got exactly the default limit
    await firstPage.fetchNext();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('should respect maxPage from factory defaults', async () => {
    const messages = makeMessages(10, 100);

    const fetch = vi.fn(
      async (_input: DiscordMessagePageFilter): Promise<DiscordMessagePageResult<TestMessage>> => ({
        data: messages
      })
    );

    // fetchPageFactory uses 0-indexed pages (FIRST_PAGE = 0).
    // maxPage: 2 allows pages 0, 1, and 2 to be fetched. Page 2 has isAtMaxPage: true,
    // and calling fetchNext on it throws FetchPageLimitReachedError.
    const factory = discordFetchMessagePageFactory({ fetch, defaults: { defaultMaxPage: 2 } });
    const page = factory({ limit: 10 });

    const firstPage = await page.fetchNext(); // page 0
    expect(firstPage.isAtMaxPage).toBe(false);

    const secondPage = await firstPage.fetchNext(); // page 1
    expect(secondPage.isAtMaxPage).toBe(false);

    const thirdPage = await secondPage.fetchNext(); // page 2 (at max)
    expect(thirdPage.isAtMaxPage).toBe(true);

    // attempting to go past max page throws
    await expect(thirdPage.fetchNext()).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
