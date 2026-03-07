import { type DecisionFunction, type IndexNumber, type IndexRef, type Maybe, type Milliseconds, type PromiseOrValue, mapIdentityFunction, performTasksFromFactoryInParallelFunction, performAsyncTasks, type PerformAsyncTasksConfig, type PerformAsyncTasksResult } from '@dereekb/util';
import { type FetchNextPage, type FetchPage, type FetchPageFactory, type FetchPageFactoryInputOptions, type FetchPageResult, type FetchPageResultWithInput } from './fetch.page';

// MARK: IterateFetchPagesByEachItem
/**
 * Callback invoked for each individual item fetched across all pages.
 *
 * Receives the item, its global index (cumulative across all pages, not just the current page),
 * and the full page result context. This enables per-item processing with awareness of both
 * the item's position in the overall iteration and the page it originated from.
 *
 * @param item - The individual item extracted from a page result
 * @param i - Global index of this item across all pages visited so far
 * @param fetchPageResult - The page result containing this item, including input and pagination info
 */
export type IterateFetchPagesByEachItemFunction<I, O, T, R> = (item: T, i: IndexNumber, fetchPageResult: FetchPageResultWithInput<I, O>) => Promise<R>;

/**
 * A tuple pairing an item with its global index across all iterated pages.
 *
 * Used internally as the task input for {@link performAsyncTasks}, allowing
 * each item to carry its positional context through parallel/sequential processing.
 */
export type IterateFetchPagesByEachItemPair<T> = readonly [T, IndexNumber];

/**
 * Configuration for {@link iterateFetchPagesByEachItem}.
 *
 * Extends {@link IterateFetchPagesByItemsConfig} but replaces the batch-level `iteratePageItems`
 * with a per-item `iterateEachPageItem` callback. Each item on every page is processed individually,
 * either sequentially (default) or in parallel via `iteratePerformTasksConfig`.
 */
export interface IterateFetchPagesByEachItemConfig<I, O, T, R> extends Omit<IterateFetchPagesByItemsConfig<I, O, T, IterateFetchPagesByEachItemResult<T, R>>, 'iteratePageItems'> {
  /**
   * Callback invoked once per item on each fetched page.
   *
   * Items are processed via {@link performAsyncTasks} — sequentially by default,
   * but configurable to run in parallel via `iteratePerformTasksConfig`.
   */
  readonly iterateEachPageItem: IterateFetchPagesByEachItemFunction<I, O, T, R>;
  /**
   * Optional configuration passed to {@link performAsyncTasks} controlling
   * how items within a single page are processed.
   *
   * By default, `sequential` is true, meaning items are processed one at a time.
   * Override to enable parallel processing, set concurrency limits, or configure retry behavior.
   */
  readonly iteratePerformTasksConfig?: Partial<PerformAsyncTasksConfig<IterateFetchPagesByEachItemPair<T>>>;
}

/**
 * Result of {@link iterateFetchPagesByEachItem}, containing success/failure details
 * for each individually processed item.
 *
 * Wraps {@link PerformAsyncTasksResult} with item-index pairs, providing access to
 * which items succeeded, failed, and their corresponding results or errors.
 */
export type IterateFetchPagesByEachItemResult<T, R> = PerformAsyncTasksResult<IterateFetchPagesByEachItemPair<T>, R>;

/**
 * Iterates through all pages of a paginated fetch and processes each item individually.
 *
 * Built on top of {@link iterateFetchPagesByItems}, this function handles per-item granularity
 * by extracting items from each page and delegating to {@link performAsyncTasks}. Items are
 * processed sequentially by default to preserve ordering guarantees, but can be parallelized
 * via `iteratePerformTasksConfig`.
 *
 * Each item's callback receives a global index that reflects its position across all pages,
 * not just within the current page.
 *
 * @param config - Configuration specifying the fetch page source, item extraction, and per-item callback
 * @returns Combined result from {@link iterateFetchPagesByItems} including page/item counts and per-item task results
 *
 * @example
 * ```typescript
 * const result = await iterateFetchPagesByEachItem({
 *   fetchPageFactory: myPageFactory,
 *   input: { query: 'active' },
 *   readItemsFromPageResult: (r) => r.result.items,
 *   iterateEachPageItem: async (item, index, pageResult) => {
 *     return processItem(item);
 *   }
 * });
 * ```
 */
export async function iterateFetchPagesByEachItem<I, O, T, R>(config: IterateFetchPagesByEachItemConfig<I, O, T, R>) {
  const { iterateEachPageItem, iteratePerformTasksConfig } = config;

  return iterateFetchPagesByItems({
    ...config,
    iteratePageItems: async (items, fetchPageResult, startIndex) => {
      const itemIndexPairs = items.map((x, i) => [x, i + startIndex] as const);

      const performTasksResults = await performAsyncTasks(
        itemIndexPairs,
        ([item, i]) => {
          return iterateEachPageItem(item, i, fetchPageResult);
        },
        {
          sequential: true, // sequential by default
          ...iteratePerformTasksConfig
        }
      );

      return performTasksResults;
    }
  });
}

// MARK: IterateFetchPagesByItems
/**
 * Filters items extracted from a page result before they are passed to the iteration callback.
 *
 * Receives all items from a single page along with the page result context.
 * Filtered-out items do not count toward `iterateItemsLimit` but the filtering
 * does not affect pagination continuation — pages continue to be fetched regardless
 * of how many items pass the filter.
 *
 * @param items - All items extracted from the current page
 * @param pageResult - The full page result including input and pagination metadata
 * @returns The filtered subset of items to process, or a promise resolving to it
 */
export type IterateFetchPagesByItemsFilterFunction<I, O, T> = (items: T[], pageResult: FetchPageResultWithInput<I, O>) => PromiseOrValue<T[]>;

/**
 * Callback invoked with all (optionally filtered) items from a single fetched page.
 *
 * Unlike {@link IterateFetchPagesByEachItemFunction} which operates per-item, this receives
 * the entire batch of items for a page, enabling bulk processing strategies.
 *
 * @param items - Items from the current page (after filtering, if configured)
 * @param fetchPageResult - The page result with input and pagination context
 * @param totalItemsVisited - Running total of items visited across all previous pages (before this batch)
 */
export type IterateFetchPagesByItemsFunction<I, O, T, R> = (items: T[], fetchPageResult: FetchPageResultWithInput<I, O>, totalItemsVisited: number) => Promise<R>;

/**
 * Configuration for {@link iterateFetchPagesByItems}.
 *
 * Extends page-level iteration with item extraction, filtering, and item-count-based
 * termination. Pages are fetched via a {@link FetchPage} or {@link FetchPageFactory},
 * items are extracted from each page result, optionally filtered, then passed to
 * `iteratePageItems` as a batch.
 *
 * Supports two independent limits: `loadItemLimit` caps the total raw items loaded
 * from the API, while `iterateItemsLimit` caps items that pass filtering.
 */
export interface IterateFetchPagesByItemsConfig<I, O, T, R> extends Omit<IterateFetchPagesConfig<I, O, R>, 'iteratePage'> {
  /**
   * Extracts typed items from a raw page result.
   *
   * Called once per page to transform the API response into the items
   * that will be filtered and iterated over.
   *
   * @param results - The raw page result from the fetch
   * @returns Array of items extracted from this page
   */
  readItemsFromPageResult(results: FetchPageResult<O>): T[];
  /**
   * Maximum number of items allowed to be visited (post-filter) across all pages.
   *
   * Items that are filtered out by `filterPageItems` do not count toward this limit.
   * Iteration ends after the page where this limit is reached; items on that final
   * page are still fully processed.
   */
  readonly iterateItemsLimit?: Maybe<number>;
  /**
   * Maximum number of raw items allowed to be loaded (pre-filter) across all pages.
   *
   * Counts all items returned by `readItemsFromPageResult`, regardless of filtering.
   * Iteration ends after the page where this limit is reached.
   */
  readonly loadItemLimit?: Maybe<number>;
  /**
   * Optional filter applied to items on each page before they reach `iteratePageItems`.
   *
   * Filtered-out items are excluded from processing and do not count toward `iterateItemsLimit`,
   * but filtering does not affect pagination — the next page is still fetched based on the
   * original (unfiltered) page result. If all items on a page are filtered out, iteration
   * continues using the last item for cursor positioning.
   *
   * Use `endEarly` or `handleRepeatCursor` to handle cases where filtering causes
   * repeated cursors or unwanted looping.
   */
  readonly filterPageItems?: IterateFetchPagesByItemsFilterFunction<I, O, T>;
  /**
   * Callback invoked with the batch of items (post-filter) from each page.
   *
   * Receives the filtered items, the page result context, and the running count
   * of total items visited before this page.
   */
  readonly iteratePageItems: IterateFetchPagesByItemsFunction<I, O, T, R>;
}

/**
 * Result of {@link iterateFetchPagesByItems}, extending page-level results
 * with item-level counters.
 */
export interface IterateFetchPagesByItemsResult<I, O, T, R> extends IterateFetchPagesResult {
  /**
   * Total number of raw items loaded from all pages (pre-filter).
   */
  readonly totalItemsLoaded: number;
  /**
   * Total number of items visited across all pages (post-filter).
   */
  readonly totalItemsVisited: number;
}

/**
 * Iterates through paginated fetch results at the item batch level.
 *
 * Fetches pages sequentially (or in parallel via `maxParallelPages`), extracts items
 * from each page using `readItemsFromPageResult`, optionally filters them, then
 * passes the batch to `iteratePageItems`. Tracks both raw loaded counts and
 * post-filter visited counts, terminating when either limit is reached or pages
 * are exhausted.
 *
 * For per-item processing instead of batch processing, use {@link iterateFetchPagesByEachItem}.
 *
 * @param config - Configuration specifying fetch source, item extraction, filtering, limits, and batch callback
 * @returns Result with page count and item counters (loaded and visited)
 *
 * @example
 * ```typescript
 * const result = await iterateFetchPagesByItems({
 *   fetchPageFactory: myPageFactory,
 *   input: { status: 'active' },
 *   readItemsFromPageResult: (r) => r.result.records,
 *   filterPageItems: (items) => items.filter(x => x.isValid),
 *   iterateItemsLimit: 500,
 *   iteratePageItems: async (items, pageResult, totalVisited) => {
 *     await bulkInsert(items);
 *   }
 * });
 * ```
 */
export async function iterateFetchPagesByItems<I, O, T, R>(config: IterateFetchPagesByItemsConfig<I, O, T, R>) {
  const { readItemsFromPageResult, iterateItemsLimit: inputTotalIterateItemsLimit, loadItemLimit: inputTotalLoadItemLimit, filterPageItems: inputFilterPageItems, iteratePageItems } = config;
  const iterateItemsLimit = inputTotalIterateItemsLimit ?? Number.MAX_SAFE_INTEGER;
  const loadItemLimit = inputTotalLoadItemLimit ?? Number.MAX_SAFE_INTEGER;
  const filterPageItems = inputFilterPageItems ?? mapIdentityFunction();

  let totalItemsLoaded = 0;
  let totalItemsVisited = 0;
  let hasReachedFinalItem = false;

  const fetchPagesConfig: IterateFetchPagesConfig<I, O, R[]> = {
    ...config,
    iteratePage: async (fetchPageResult) => {
      const items = readItemsFromPageResult(fetchPageResult);
      const filteredItems = await filterPageItems(items, fetchPageResult);
      const results = await iteratePageItems(filteredItems, fetchPageResult, totalItemsVisited);

      totalItemsLoaded += items.length;
      totalItemsVisited += filteredItems.length;
      hasReachedFinalItem = totalItemsLoaded >= loadItemLimit || totalItemsVisited >= iterateItemsLimit;

      return results;
    },
    endEarly: () => hasReachedFinalItem
  } as IterateFetchPagesConfig<I, O, R[]>;

  const iterateFetchPagesResult = await iterateFetchPages<I, O, R[]>(fetchPagesConfig);

  return {
    ...iterateFetchPagesResult,
    totalItemsLoaded,
    totalItemsVisited
  };
}

// MARK: IterateFetchPages
/**
 * Union type for {@link iterateFetchPages} configuration.
 *
 * Accepts either a factory-based config (providing `input` + `fetchPageFactory` to create
 * the {@link FetchPage} on demand) or an instance-based config (providing a pre-created
 * `fetchPage` directly). This flexibility supports both lazy and eager page initialization.
 */
export type IterateFetchPagesConfig<I, O, R> = IterateFetchPagesConfigWithFactoryAndInput<I, O, R> | IterateFetchPagesConfigWithFetchPageInstance<I, O, R>;

/**
 * Configuration variant that creates a {@link FetchPage} from a factory and input.
 *
 * Use this when you have a reusable {@link FetchPageFactory} and want the iterator
 * to handle page instantiation. The factory receives the input along with any
 * `maxPage`/`maxItemsPerPage` options from {@link FetchPageFactoryInputOptions}.
 */
export interface IterateFetchPagesConfigWithFactoryAndInput<I, O, R> extends BaseIterateFetchPagesConfig<I, O, R> {
  /**
   * The query/filter input passed to the fetch page factory to initialize pagination.
   */
  readonly input: I;
  /**
   * Factory that creates a {@link FetchPage} from the given input and options.
   */
  readonly fetchPageFactory: FetchPageFactory<I, O>;
}

/**
 * Configuration variant that uses a pre-created {@link FetchPage} instance directly.
 *
 * Use this when you already have a configured {@link FetchPage} and don't need
 * the iterator to create one via a factory.
 */
export interface IterateFetchPagesConfigWithFetchPageInstance<I, O, R> extends BaseIterateFetchPagesConfig<I, O, R> {
  /**
   * Pre-created fetch page instance to iterate through.
   */
  readonly fetchPage: FetchPage<I, O>;
}

/**
 * Base configuration shared by all {@link iterateFetchPages} config variants.
 *
 * Provides the core iteration hooks (`iteratePage`, `usePageResult`, `endEarly`),
 * concurrency controls (`maxParallelPages`, `waitBetweenPages`), and pagination
 * limits inherited from {@link FetchPageFactoryInputOptions}.
 */
export interface BaseIterateFetchPagesConfig<I, O, R> extends FetchPageFactoryInputOptions {
  /**
   * Optional input for the page fetch. Required when using `fetchPageFactory`,
   * ignored when using a pre-created `fetchPage`.
   */
  readonly input?: I;
  /**
   * Optional factory for creating the {@link FetchPage}. Mutually exclusive
   * with `fetchPage` — provide one or the other.
   */
  readonly fetchPageFactory?: FetchPageFactory<I, O>;
  /**
   * Optional pre-created {@link FetchPage} instance. Mutually exclusive
   * with `fetchPageFactory` + `input`.
   */
  readonly fetchPage?: FetchPage<I, O>;
  /**
   * Maximum number of pages to process concurrently.
   *
   * Defaults to 1 (serial execution). When set higher, pages are fetched
   * and processed in parallel using {@link performTasksFromFactoryInParallelFunction}.
   * Note that page *fetching* is always sequential (each page depends on the
   * previous page's cursor), but page *processing* via `iteratePage` can overlap.
   */
  readonly maxParallelPages?: number;
  /**
   * Minimum delay in milliseconds between initiating consecutive page fetches.
   *
   * Useful for rate limiting API calls. When running in parallel, this ensures
   * at least this much time passes between starting each new page request.
   */
  readonly waitBetweenPages?: Milliseconds;
  /**
   * Core iteration callback invoked once per fetched page.
   *
   * Receives the full page result including the original input and pagination metadata.
   * The return value is captured in the {@link IterateFetchPagesIterationResult} and
   * made available to `usePageResult` and `endEarly`.
   *
   * @param result - The fetched page result with input context
   * @returns The processing result for this page
   */
  iteratePage(result: FetchPageResultWithInput<I, O>): Promise<R>;
  /**
   * Optional side-effect callback invoked after each page is fully processed.
   *
   * Called after `iteratePage` completes, receiving the full iteration result
   * including the page index, fetch result, and processing result. Useful for
   * logging, progress tracking, or accumulating results externally.
   *
   * @param pageResult - The complete iteration result for this page
   */
  usePageResult?(pageResult: IterateFetchPagesIterationResult<I, O, R>): PromiseOrValue<void>;
  /**
   * Optional early termination predicate evaluated after each page.
   *
   * When this returns `true`, no further pages will be fetched. Any pages
   * already in-flight (when using parallel processing) will still complete.
   * Checked after both `iteratePage` and `usePageResult` have finished.
   *
   * @param pageResult - The complete iteration result for the most recent page
   * @returns `true` to stop iteration after this page
   */
  endEarly?: DecisionFunction<IterateFetchPagesIterationResult<I, O, R>>;
}

/**
 * Intermediate result produced after processing a single page during iteration.
 *
 * Passed to {@link BaseIterateFetchPagesConfig.usePageResult} and
 * {@link BaseIterateFetchPagesConfig.endEarly} to enable post-page logic
 * and conditional termination.
 */
export interface IterateFetchPagesIterationResult<I, O, R> extends IndexRef {
  /**
   * Zero-based page index within this iteration run.
   */
  readonly i: IndexNumber;
  /**
   * The raw fetch page result including pagination metadata and the original input.
   */
  readonly fetchPageResult: FetchPageResultWithInput<I, O>;
  /**
   * Value returned by `iteratePage` for this page.
   */
  readonly result: R;
}

/**
 * Final result returned by {@link iterateFetchPages} after all pages have been processed.
 */
export interface IterateFetchPagesResult {
  /**
   * Total number of pages fetched and processed during this iteration.
   */
  readonly totalPages: number;
  /**
   * Whether iteration stopped because the configured `maxPage` limit was reached,
   * as opposed to running out of pages or an early termination via `endEarly`.
   */
  readonly totalPagesLimitReached: boolean;
}

/**
 * Core pagination iterator that fetches and processes pages from a {@link FetchPage} source.
 *
 * This is the foundational function in the fetch page iteration hierarchy. It drives
 * sequential page fetching (each page depends on the previous page's cursor/state),
 * with optional parallel *processing* of fetched pages via `maxParallelPages`.
 *
 * The iteration loop continues until one of these conditions is met:
 * - No more pages are available (`hasNext` is false)
 * - The `maxPage` limit from {@link FetchPageFactoryInputOptions} is reached
 * - The `endEarly` predicate returns true
 *
 * Higher-level functions {@link iterateFetchPagesByItems} and {@link iterateFetchPagesByEachItem}
 * build on this to add item extraction, filtering, and per-item processing.
 *
 * @param config - Configuration specifying the page source, processing callback, and iteration controls
 * @returns Summary of the iteration including total pages visited and whether the page limit was hit
 *
 * @example
 * ```typescript
 * // Using a factory
 * const result = await iterateFetchPages({
 *   input: { query: 'active', pageSize: 50 },
 *   fetchPageFactory: myFactory,
 *   maxPage: 10,
 *   iteratePage: async (pageResult) => {
 *     console.log(`Page ${pageResult.page}:`, pageResult.result);
 *     return pageResult.result.items.length;
 *   },
 *   endEarly: ({ result }) => result === 0
 * });
 *
 * // Using a pre-created FetchPage instance
 * const result = await iterateFetchPages({
 *   fetchPage: existingFetchPage,
 *   iteratePage: async (pageResult) => {
 *     await processBatch(pageResult.result);
 *   }
 * });
 * ```
 */
export async function iterateFetchPages<I, O, R>(config: IterateFetchPagesConfigWithFactoryAndInput<I, O, R>): Promise<IterateFetchPagesResult>;
export async function iterateFetchPages<I, O, R>(config: IterateFetchPagesConfigWithFetchPageInstance<I, O, R>): Promise<IterateFetchPagesResult>;
export async function iterateFetchPages<I, O, R>(config: IterateFetchPagesConfig<I, O, R>): Promise<IterateFetchPagesResult>;
export async function iterateFetchPages<I, O, R>(config: IterateFetchPagesConfig<I, O, R>): Promise<IterateFetchPagesResult> {
  const { iteratePage, fetchPage: inputFetchPage, input, fetchPageFactory, usePageResult, maxParallelPages, waitBetweenPages, maxPage, maxItemsPerPage, endEarly } = config;

  let hasReachedEnd = false;
  let fetchPage: FetchPage<I, O> = inputFetchPage ?? (fetchPageFactory as FetchPageFactory<I, O>)(input as I, { maxPage, maxItemsPerPage });
  let currentNextPage: Maybe<FetchNextPage<I, O>>;

  async function taskInputFactory() {
    if (hasReachedEnd) {
      return null; // issue no more tasks
    }

    if (currentNextPage != null && (currentNextPage.isAtMaxPage || !currentNextPage.hasNext)) {
      hasReachedEnd = true;
      return null;
    }

    currentNextPage = await fetchPage.fetchNext();
    fetchPage = currentNextPage;

    return {
      i: currentNextPage.page,
      fetchPageResult: currentNextPage
    };
  }

  const performTaskFn = performTasksFromFactoryInParallelFunction({
    maxParallelTasks: maxParallelPages,
    waitBetweenTasks: waitBetweenPages,
    taskFactory: async ({ i, fetchPageResult }: { i: IndexNumber; fetchPageResult: FetchPageResultWithInput<I, O> }) => {
      const result = await iteratePage(fetchPageResult);
      const iterationResult: IterateFetchPagesIterationResult<I, O, R> = {
        i,
        fetchPageResult,
        result
      };

      await usePageResult?.(iterationResult);

      const shouldEndEarly = endEarly?.(iterationResult);
      if (shouldEndEarly) {
        hasReachedEnd = true;
      }
    }
  });

  await performTaskFn(taskInputFactory);

  const result: IterateFetchPagesResult = {
    totalPages: (currentNextPage?.page ?? 0) + 1,
    totalPagesLimitReached: currentNextPage?.isAtMaxPage ?? false
  };

  return result;
}
