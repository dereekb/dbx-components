import { type Factory, type IndexNumber, type Maybe, type Milliseconds, type PromiseOrValue, lastValue } from '@dereekb/util';
import { iterateFetchPages } from '@dereekb/util/fetch';
import { DEFAULT_DISCORD_MESSAGES_PER_PAGE, discordFetchMessagePageFactory, type DiscordFetchMessagePageFetchFunction, type DiscordMessagePageFilter, type DiscordMessagePageResult } from './discord.api.page';
import { discordSnowflakeIsAfter } from './discord.snowflake';
import { type DiscordMessageId } from './discord.type';

/**
 * Why a scan stopped walking messages.
 *
 * `stop_bound` and `channel_start` mean the scan is caught up; the rest mean it exhausted a budget
 * and can be resumed from {@link DiscordScanMessagesResult.resumeBeforeMessageId}.
 */
export type DiscordScanStopReason =
  /**
   * Reached the `afterMessageId` stop bound. Everything newer than it has been handled.
   */
  | 'stop_bound'
  /**
   * Reached a short page, meaning no older messages exist in the channel.
   */
  | 'channel_start'
  /**
   * Loaded as many messages as the scan was budgeted for.
   */
  | 'max_messages'
  /**
   * Loaded as many pages as the scan was budgeted for.
   */
  | 'max_pages'
  /**
   * Ran out of the scan's time budget.
   */
  | 'time_budget';

/**
 * A single page's worth of messages delivered to a {@link DiscordScanMessagesBatchHandler}.
 *
 * @typeParam T - The message type.
 */
export interface DiscordScanMessagesBatch<T> {
  /**
   * The messages in this batch, newest-first, as Discord returns them.
   *
   * Never empty: a batch with no messages is not delivered to the handler at all.
   */
  readonly messages: T[];
  /**
   * The id of the newest message in this batch.
   */
  readonly newestMessageId: DiscordMessageId;
  /**
   * The id of the oldest message in this batch.
   */
  readonly oldestMessageId: DiscordMessageId;
  /**
   * The zero-based index of the page this batch came from within this scan.
   */
  readonly page: IndexNumber;
  /**
   * The total number of messages handed to the handler by this scan so far, including this batch.
   */
  readonly totalMessagesHandled: number;
}

/**
 * Handles a single batch of messages during a scan.
 *
 * Batches arrive one at a time, newest page first, and the scan waits for each one before fetching
 * the next page.
 */
export type DiscordScanMessagesBatchHandler<T> = (batch: DiscordScanMessagesBatch<T>) => Promise<void>;

/**
 * The work budget for a scan.
 *
 * Every value is optional; an unset value means that particular budget is unbounded. A scan with no
 * budget at all walks back to the start of the channel or to its stop bound.
 */
export interface DiscordScanMessagesBounds {
  /**
   * The number of messages to request per page.
   *
   * Defaults to {@link DEFAULT_DISCORD_MESSAGES_PER_PAGE}.
   */
  readonly messagesPerPage?: Maybe<number>;
  /**
   * The maximum number of pages to fetch.
   */
  readonly maxPages?: Maybe<number>;
  /**
   * The maximum number of messages to load, counted before filtering.
   *
   * Counted pre-filter so that a scan whose filter rejects everything still terminates.
   */
  readonly maxMessages?: Maybe<number>;
  /**
   * The maximum amount of time the scan may spend, checked after each page.
   */
  readonly maxDuration?: Maybe<Milliseconds>;
  /**
   * The amount of time to wait between page fetches.
   */
  readonly waitBetweenPages?: Maybe<Milliseconds>;
}

/**
 * Configuration for {@link discordScanMessagesFactory}.
 *
 * @typeParam I - The fetch input filter type.
 * @typeParam T - The message type.
 */
export interface DiscordScanMessagesFactoryConfig<I extends DiscordMessagePageFilter, T extends { id: string }> {
  /**
   * The Discord message fetch function to scan with.
   */
  readonly fetch: DiscordFetchMessagePageFetchFunction<I, T>;
  /**
   * Reads the snowflake id from a message. Defaults to reading the `id` property.
   */
  readonly readMessageId?: Maybe<(message: T) => DiscordMessageId>;
  /**
   * Default bounds applied to every scan, overridden per-scan by the scan input.
   */
  readonly defaults?: Maybe<DiscordScanMessagesBounds>;
  /**
   * Factory for the current time, used for the `maxDuration` budget.
   *
   * Exists as a seam so a spec can drive the time budget deterministically.
   */
  readonly nowFactory?: Maybe<Factory<Date>>;
}

/**
 * Input for a single scan.
 *
 * @typeParam I - The fetch input filter type.
 * @typeParam T - The message type.
 */
export interface DiscordScanMessagesInput<I extends DiscordMessagePageFilter, T extends { id: string }> extends DiscordScanMessagesBounds {
  /**
   * The non-pagination part of the fetch input, such as the channel id.
   *
   * The pagination fields are owned by the scan and are built from the bounds below.
   */
  readonly baseInput: Omit<I, keyof DiscordMessagePageFilter>;
  /**
   * The START bound, exclusive. The scan begins with the messages immediately older than this id.
   *
   * Leave undefined to start from the newest message in the channel. Resume an interrupted scan by
   * passing its {@link DiscordScanMessagesResult.resumeBeforeMessageId} here.
   */
  readonly beforeMessageId?: Maybe<DiscordMessageId>;
  /**
   * The STOP bound, exclusive. The scan stops once it walks back to this id.
   *
   * Leave undefined to walk back to the start of the channel. This is typically the high-water mark
   * from the previous completed scan.
   */
  readonly afterMessageId?: Maybe<DiscordMessageId>;
  /**
   * Optional filter applied to each page before the handler sees it.
   *
   * Filtered-out messages are still counted as loaded and still move the resume cursor past
   * themselves, so they are never revisited.
   */
  readonly filterMessages?: Maybe<(messages: T[]) => PromiseOrValue<T[]>>;
  /**
   * Handles each batch of messages. Not invoked for an empty batch.
   */
  readonly handleMessages: DiscordScanMessagesBatchHandler<T>;
}

/**
 * The outcome of a scan.
 */
export interface DiscordScanMessagesResult {
  /**
   * Why the scan stopped.
   */
  readonly stopReason: DiscordScanStopReason;
  /**
   * Whether the scan reached its stop bound or the start of the channel.
   *
   * When true the caller has seen everything it asked for and should promote
   * {@link newestMessageId} to its high-water mark. When false the scan ran out of budget and
   * should be resumed from {@link resumeBeforeMessageId}.
   */
  readonly complete: boolean;
  /**
   * The id of the newest message the scan loaded, before filtering.
   *
   * Undefined when the scan loaded nothing.
   */
  readonly newestMessageId: Maybe<DiscordMessageId>;
  /**
   * The id to pass as `beforeMessageId` to resume this scan.
   *
   * This is the oldest message the scan LOADED, not the oldest it delivered, so filtered-out
   * messages are not revisited. Only meaningful when {@link complete} is false.
   */
  readonly resumeBeforeMessageId: Maybe<DiscordMessageId>;
  /**
   * The number of pages fetched.
   */
  readonly totalPages: number;
  /**
   * The number of messages loaded, before filtering and before the stop bound truncated a page.
   */
  readonly totalMessagesLoaded: number;
  /**
   * The number of messages delivered to the handler.
   */
  readonly totalMessagesHandled: number;
  /**
   * When the scan started.
   */
  readonly startedAt: Date;
  /**
   * When the scan ended.
   */
  readonly endedAt: Date;
}

/**
 * Scans a Discord channel's messages, handing each batch to the input handler.
 *
 * @typeParam I - The fetch input filter type.
 * @typeParam T - The message type.
 */
export type DiscordScanMessagesFunction<I extends DiscordMessagePageFilter, T extends { id: string }> = (input: DiscordScanMessagesInput<I, T>) => Promise<DiscordScanMessagesResult>;

/**
 * Creates a {@link DiscordScanMessagesFunction} that walks a channel's messages backwards in time
 * and hands each page to a caller-supplied handler.
 *
 * The scan is persistence-agnostic: it knows nothing about where a cursor is stored. It walks from
 * `beforeMessageId` (or the newest message) back towards `afterMessageId` (or the start of the
 * channel), stops as soon as a budget is exhausted, and reports where it stopped so the caller can
 * resume from exactly there.
 *
 * @param config - The fetch function and scan defaults.
 * @returns A scan function.
 *
 * @example
 * ```ts
 * const scan = discordScanMessagesFactory({ fetch: fetchChannelMessages });
 *
 * const result = await scan({
 *   baseInput: { channelId },
 *   afterMessageId: lastScannedMessageId,
 *   maxMessages: 1000,
 *   handleMessages: async ({ messages }) => saveMessages(messages)
 * });
 *
 * if (result.complete) {
 *   lastScannedMessageId = result.newestMessageId ?? lastScannedMessageId;
 * }
 * ```
 */
export function discordScanMessagesFactory<I extends DiscordMessagePageFilter, T extends { id: string }>(config: DiscordScanMessagesFactoryConfig<I, T>): DiscordScanMessagesFunction<I, T> {
  const { fetch, readMessageId: inputReadMessageId, defaults, nowFactory: inputNowFactory } = config;
  const readMessageId = inputReadMessageId ?? ((message: T) => message.id);
  const nowFactory = inputNowFactory ?? (() => new Date());

  return async (input: DiscordScanMessagesInput<I, T>) => {
    const { baseInput, beforeMessageId, afterMessageId, filterMessages, handleMessages } = input;

    const messagesPerPage = input.messagesPerPage ?? defaults?.messagesPerPage ?? DEFAULT_DISCORD_MESSAGES_PER_PAGE;
    const maxPages = input.maxPages ?? defaults?.maxPages;
    const maxMessages = input.maxMessages ?? defaults?.maxMessages;
    const maxDuration = input.maxDuration ?? defaults?.maxDuration;
    const waitBetweenPages = input.waitBetweenPages ?? defaults?.waitBetweenPages;

    // the page factory reads the same messagesPerPage everywhere, so the first page and every page
    // after it use one limit and short-page detection stays honest
    const fetchPageFactory = discordFetchMessagePageFactory<I, T>({
      fetch,
      config: { readMessageId },
      defaults: { defaultMaxItemsPerPage: messagesPerPage }
    });

    const startedAt = nowFactory();

    let totalPages = 0;
    let totalMessagesLoaded = 0;
    let totalMessagesHandled = 0;
    let newestMessageId: Maybe<DiscordMessageId>;
    let resumeBeforeMessageId: Maybe<DiscordMessageId>;

    let reachedStopBound = false;
    let reachedChannelStart = false;
    let reachedMaxMessages = false;
    let reachedTimeBudget = false;

    const pageInput = {
      ...baseInput,
      before: beforeMessageId ?? undefined,
      after: undefined,
      around: undefined,
      limit: messagesPerPage
    } as unknown as I;

    const iterateResult = await iterateFetchPages<I, DiscordMessagePageResult<T>, void>({
      input: pageInput,
      fetchPageFactory,
      // maxPage is the max page INDEX, so a page count of N is an index of N - 1
      maxPage: maxPages == null ? null : Math.max(0, maxPages - 1),
      maxItemsPerPage: messagesPerPage,
      maxParallelPages: 1, // cursor bookkeeping and handler ordering both require serial pages
      waitBetweenPages: waitBetweenPages ?? undefined,
      iteratePage: async (fetchPageResult) => {
        const raw = fetchPageResult.result.data;

        totalPages += 1;
        totalMessagesLoaded += raw.length;

        if (raw.length < messagesPerPage) {
          reachedChannelStart = true; // a short page means there is nothing older to load
        }

        if (raw.length > 0) {
          newestMessageId = newestMessageId ?? readMessageId(raw[0]);
          // the OLDEST RAW message, so filtered-out messages are stepped past rather than revisited
          resumeBeforeMessageId = readMessageId(lastValue(raw));

          let bounded = raw;

          if (afterMessageId != null) {
            const stopBoundIndex = raw.findIndex((message) => !discordSnowflakeIsAfter(readMessageId(message), afterMessageId));

            if (stopBoundIndex >= 0) {
              reachedStopBound = true;
              bounded = raw.slice(0, stopBoundIndex);
            }
          }

          const messages = (await filterMessages?.(bounded)) ?? bounded;

          if (messages.length > 0) {
            totalMessagesHandled += messages.length;

            await handleMessages({
              messages,
              newestMessageId: readMessageId(messages[0]),
              oldestMessageId: readMessageId(lastValue(messages)),
              page: fetchPageResult.page,
              totalMessagesHandled
            });
          }
        }

        if (maxMessages != null && totalMessagesLoaded >= maxMessages) {
          reachedMaxMessages = true;
        }

        if (maxDuration != null && nowFactory().getTime() - startedAt.getTime() >= maxDuration) {
          reachedTimeBudget = true;
        }
      },
      // ordered by priority so the reported stopReason is deterministic. channel_start is what keeps
      // the iteration from asking a cursor-based source for a page that does not exist.
      endEarly: () => reachedStopBound || reachedChannelStart || reachedMaxMessages || reachedTimeBudget
    });

    let stopReason: DiscordScanStopReason;

    if (reachedStopBound) {
      stopReason = 'stop_bound';
    } else if (reachedChannelStart) {
      stopReason = 'channel_start';
    } else if (reachedMaxMessages) {
      stopReason = 'max_messages';
    } else if (reachedTimeBudget) {
      stopReason = 'time_budget';
    } else if (iterateResult.totalPagesLimitReached) {
      stopReason = 'max_pages';
    } else {
      stopReason = 'channel_start'; // the page source reported it had no further pages
    }

    const result: DiscordScanMessagesResult = {
      stopReason,
      complete: stopReason === 'stop_bound' || stopReason === 'channel_start',
      newestMessageId,
      resumeBeforeMessageId,
      totalPages,
      totalMessagesLoaded,
      totalMessagesHandled,
      startedAt,
      endedAt: nowFactory()
    };

    return result;
  };
}
