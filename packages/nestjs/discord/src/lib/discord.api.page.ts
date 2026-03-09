import { type Maybe, type PromiseOrValue, lastValue } from '@dereekb/util';
import { fetchPageFactory, type FetchPageFactory, type ReadFetchPageResultInfo, type FetchPageResult, type FetchPageFactoryInputOptions, type FetchPageFactoryConfigDefaults } from '@dereekb/util/fetch';
import { type DiscordMessageId } from './discord.type';

/**
 * Default number of messages per page when fetching Discord channel messages.
 */
export const DISCORD_DEFAULT_MESSAGES_PER_PAGE = 100;

/**
 * Base pagination parameters for Discord channel message endpoints.
 *
 * Discord uses cursor-based pagination via snowflake IDs rather than page numbers.
 * Only one of `before`, `after`, or `around` should be specified per request.
 */
export interface DiscordMessagePageFilter {
  /**
   * Fetch messages before this message ID.
   */
  readonly before?: Maybe<DiscordMessageId>;
  /**
   * Fetch messages after this message ID.
   */
  readonly after?: Maybe<DiscordMessageId>;
  /**
   * Fetch messages around this message ID.
   */
  readonly around?: Maybe<DiscordMessageId>;
  /**
   * Maximum number of messages to return per page (1-100).
   *
   * Defaults to {@link DISCORD_DEFAULT_MESSAGES_PER_PAGE}.
   */
  readonly limit?: Maybe<number>;
}

/**
 * Result of a paginated Discord message fetch containing the array of messages.
 *
 * @typeParam T - The message type (typically discord.js `Message`)
 */
export interface DiscordMessagePageResult<T> {
  /**
   * Array of messages returned.
   */
  readonly data: T[];
}

/**
 * A fetch function that accepts {@link DiscordMessagePageFilter} input and returns a {@link DiscordMessagePageResult}.
 * Used as the underlying data source for {@link discordFetchMessagePageFactory}.
 */
export type DiscordFetchMessagePageFetchFunction<I extends DiscordMessagePageFilter, T> = (input: I) => Promise<DiscordMessagePageResult<T>>;

/**
 * Configuration for {@link discordFetchMessagePageFactory}.
 *
 * @typeParam T - The message type
 */
export interface DiscordFetchMessagePageFactoryConfig<T> {
  /**
   * Extracts the snowflake ID from a message object. Used to determine the cursor for the next page.
   *
   * Defaults to reading the `id` property on the message.
   */
  readonly readMessageId?: (message: T) => DiscordMessageId;
}

/**
 * Creates a page factory that wraps a Discord message fetch function with automatic cursor-based pagination.
 *
 * Discord paginates via `before`/`after` snowflake IDs. This factory automatically reads the last
 * message's ID from each response and sets it as the `before` cursor for the next request.
 * When the number of returned messages is less than the requested limit, pagination stops.
 *
 * @param fetch - The Discord fetch function to paginate over
 * @param config - Optional config for reading message IDs
 * @param defaults - Optional default configuration for the page factory
 * @returns A page factory that produces iterable page fetchers
 *
 * @example
 * ```typescript
 * const pageFactory = discordFetchMessagePageFactory(fetchChannelMessages);
 *
 * const fetchPage = pageFactory({ limit: 50 });
 * const firstPage = await fetchPage.fetchNext();
 *
 * if (firstPage.hasNext) {
 *   const secondPage = await firstPage.fetchNext();
 * }
 * ```
 */
export function discordFetchMessagePageFactory<I extends DiscordMessagePageFilter, T extends { id: string }>(fetch: DiscordFetchMessagePageFetchFunction<I, T>, config?: Maybe<DiscordFetchMessagePageFactoryConfig<T>>, defaults?: Maybe<FetchPageFactoryConfigDefaults>): FetchPageFactory<I, DiscordMessagePageResult<T>> {
  const readMessageId = config?.readMessageId ?? ((message: T) => message.id);

  return fetchPageFactory<I, DiscordMessagePageResult<T>>({
    ...defaults,
    fetch,
    readFetchPageResultInfo(result: DiscordMessagePageResult<T>): PromiseOrValue<ReadFetchPageResultInfo> {
      const count = result.data.length;
      const lastMessage = lastValue(result.data);
      const nextCursor = lastMessage ? readMessageId(lastMessage) : undefined;

      return {
        hasNext: count > 0,
        nextPageCursor: nextCursor
      };
    },
    buildInputForNextPage(pageResult: Partial<FetchPageResult<DiscordMessagePageResult<T>>>, input: I, options: FetchPageFactoryInputOptions): PromiseOrValue<Maybe<Partial<I>>> {
      const nextCursor = pageResult.nextPageCursor;
      const effectiveLimit = options.maxItemsPerPage ?? input.limit ?? DISCORD_DEFAULT_MESSAGES_PER_PAGE;
      const resultCount = pageResult.result?.data.length ?? 0;

      // Discord signals no more results when fewer items than the limit are returned
      if (!nextCursor || resultCount < effectiveLimit) {
        return undefined;
      }

      return {
        ...input,
        before: nextCursor,
        after: undefined,
        around: undefined,
        limit: effectiveLimit
      } as Partial<I>;
    }
  });
}
