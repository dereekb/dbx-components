import { type DecisionFunction, type IndexNumber, type IndexRef, type Maybe, type Milliseconds, type PromiseOrValue, mapIdentityFunction, performTasksFromFactoryInParallelFunction, performAsyncTasks, type PerformAsyncTasksConfig, type PerformAsyncTasksResult } from '@dereekb/util';
import { type FetchNextPage, type FetchPage, type FetchPageFactory, type FetchPageFactoryInputOptions, type FetchPageResult, type FetchPageResultWithInput } from './fetch.page';

// MARK: IterateFetchPagesByEachItem
/**
 * Function called for each item that was fetched, along with the index and fetch results.
 *
 * The index is the overall index this item is from the returned items.
 */
export type IterateFetchPagesByEachItemFunction<I, O, T, R> = (item: T, i: IndexNumber, fetchPageResult: FetchPageResultWithInput<I, O>) => Promise<R>;

export type IterateFetchPagesByEachItemPair<T> = readonly [T, IndexNumber];

export interface IterateFetchPagesByEachItemConfig<I, O, T, R> extends Omit<IterateFetchPagesByItemsConfig<I, O, T, IterateFetchPagesByEachItemResult<T, R>>, 'iteratePageItems'> {
  /**
   * The iterate function per each page result.
   */
  readonly iterateEachPageItem: IterateFetchPagesByEachItemFunction<I, O, T, R>;
  /**
   * Optional additional configuration to pass to the
   *
   * By default, sequential is true.
   */
  readonly iteratePerformTasksConfig?: Partial<PerformAsyncTasksConfig<IterateFetchPagesByEachItemPair<T>>>;
}

export type IterateFetchPagesByEachItemResult<T, R> = PerformAsyncTasksResult<IterateFetchPagesByEachItemPair<T>, R>;

/**
 * Iterates through the pages of a created FetchPage instance by each item individually.
 *
 * @param config
 * @returns
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
 * Filter function used to filter out items.
 *
 * @param snapshot
 * @returns
 */
export type IterateFetchPagesByItemsFilterFunction<I, O, T> = (items: T[], pageResult: FetchPageResultWithInput<I, O>) => PromiseOrValue<T[]>;

export type IterateFetchPagesByItemsFunction<I, O, T, R> = (items: T[], fetchPageResult: FetchPageResultWithInput<I, O>, totalItemsVisited: number) => Promise<R>;

export interface IterateFetchPagesByItemsConfig<I, O, T, R> extends Omit<IterateFetchPagesConfig<I, O, R>, 'iteratePage'> {
  /**
   * Read individual items from page result.
   *
   * @param items
   * @returns
   */
  readItemsFromPageResult(results: FetchPageResult<O>): T[];
  /**
   * The total number of items allowed to be visited/used.
   *
   * If items are filtered out, they do not count towards the visit total.
   *
   * Ends on the page that reaches this limit.
   */
  readonly iterateItemsLimit?: Maybe<number>;
  /**
   * The total number of items allowed to be loaded from all pages.
   *
   * Ends on the page that reaches this limit.
   */
  readonly loadItemLimit?: Maybe<number>;
  /**
   * Filter function that can be used to filter out items from a result
   *
   * If all items are filtered out then the iteration will continue with final item of the snapshot regardless of filtering. The filtering does not impact the continuation decision.
   * Use the handleRepeatCursor to properly exit the loop in unwanted repeat cursor cases.
   *
   * @param snapshot
   * @returns
   */
  readonly filterPageItems?: IterateFetchPagesByItemsFilterFunction<I, O, T>;
  /**
   * The iterate function per each page result.
   */
  readonly iteratePageItems: IterateFetchPagesByItemsFunction<I, O, T, R>;
}

export interface IterateFetchPagesByItemsResult<I, O, T, R> extends IterateFetchPagesResult {
  readonly totalItemsLoaded: number;
  readonly totalItemsVisited: number;
}

/**
 * Iterates through the pages of a created FetchPage instance.
 *
 * @param config
 * @returns
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
export type IterateFetchPagesConfig<I, O, R> = IterateFetchPagesConfigWithFactoryAndInput<I, O, R> | IterateFetchPagesConfigWithFetchPageInstance<I, O, R>;

export interface IterateFetchPagesConfigWithFactoryAndInput<I, O, R> extends BaseIterateFetchPagesConfig<I, O, R> {
  /**
   * Input for the page fetch.
   */
  readonly input: I;
  readonly fetchPageFactory: FetchPageFactory<I, O>;
}

export interface IterateFetchPagesConfigWithFetchPageInstance<I, O, R> extends BaseIterateFetchPagesConfig<I, O, R> {
  readonly fetchPage: FetchPage<I, O>;
}

export interface BaseIterateFetchPagesConfig<I, O, R> extends FetchPageFactoryInputOptions {
  /**
   * Input for the page fetch.
   */
  readonly input?: I;
  readonly fetchPageFactory?: FetchPageFactory<I, O>;
  readonly fetchPage?: FetchPage<I, O>;
  /**
   * The number of max parallel pages to run.
   *
   * By default pages are run serially (max of 1), but can be run in parallel.
   */
  readonly maxParallelPages?: number;
  /**
   * The amount of time to add as a delay between beginning a new page.
   *
   * If in parallel this is the minimum amount of time to wait before starting a new page.
   */
  readonly waitBetweenPages?: Milliseconds;
  /**
   * The iterate function per each page result.
   */
  iteratePage(result: FetchPageResultWithInput<I, O>): Promise<R>;
  /**
   * (Optional) Called at the end of each page.
   */
  usePageResult?(pageResult: IterateFetchPagesIterationResult<I, O, R>): PromiseOrValue<void>;
  /**
   * (Optional) Function to check whether or not to end the iteration early based on the result.
   *
   * @param pageResult
   * @returns
   */
  endEarly?: DecisionFunction<IterateFetchPagesIterationResult<I, O, R>>;
}

export interface IterateFetchPagesIterationResult<I, O, R> extends IndexRef {
  /***
   * Page index number
   */
  readonly i: IndexNumber;
  /**
   * The returned fetch page result
   */
  readonly fetchPageResult: FetchPageResultWithInput<I, O>;
  /**
   * Results returned from each page.
   */
  readonly result: R;
}

export interface IterateFetchPagesResult {
  /**
   * The total number of pages visited.
   */
  readonly totalPages: number;
  /**
   * Whether or not the total page limit was reached.
   */
  readonly totalPagesLimitReached: boolean;
}

/**
 * Iterates through the pages of a created FetchPage instance.
 *
 * @param config
 * @returns
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
