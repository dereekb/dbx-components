import type { OnCallFunctionType, OnCallQueryModelResult } from '@dereekb/firebase';
import { performAsyncTasks, type Maybe, type PerformAsyncTasksConfig } from '@dereekb/util';
import { type CliContext } from '../context/cli.context';

/**
 * State passed into {@link IterateDbxCliCallModelConfig.buildRequestData} when assembling
 * the next page's request payload.
 */
export interface IterateDbxCliCallModelPageState {
  /**
   * Zero-based index of the page about to be fetched.
   */
  readonly pageIndex: number;
  /**
   * Cursor key returned by the previous page, or undefined for the first page.
   */
  readonly cursorDocumentKey: Maybe<string>;
  /**
   * Total items visited prior to this page.
   */
  readonly visitedItems: number;
}

/**
 * Per-item callback signature for {@link iterateDbxCliCallModel}.
 *
 * @typeParam TItem - The item type yielded by the page response.
 * @typeParam TItemResult - The value produced by processing one item.
 */
export type IterateDbxCliCallModelItemFn<TItem, TItemResult> = (input: { readonly context: CliContext; readonly item: TItem; readonly key: string; readonly pageIndex: number; readonly itemIndex: number }) => Promise<TItemResult>;

/**
 * Per-page callback signature for {@link iterateDbxCliCallModel}. Invoked after
 * {@link IterateDbxCliCallModelItemFn} (when both are configured).
 */
export type IterateDbxCliCallModelPageFn<TItem, TRaw, TItemResult, TPageResult> = (input: { readonly context: CliContext; readonly page: TRaw; readonly items: ReadonlyArray<TItem>; readonly keys: ReadonlyArray<string>; readonly pageIndex: number; readonly pageItemResults?: ReadonlyArray<TItemResult> }) => Promise<TPageResult>;

/**
 * Adapter that maps an arbitrary `callModel` response shape into the pieces
 * {@link iterateDbxCliCallModel} needs (items, cursor, has-more).
 *
 * Defaults to the {@link OnCallQueryModelResult} shape — supply a custom adapter
 * when iterating responses from other call types (e.g. `getMultiple`-style calls
 * or custom standalone calls that return an array of records).
 */
export interface IterateDbxCliCallModelResponseAdapter<TRaw, TItem> {
  /**
   * Pulls the page's items out of the raw response.
   */
  readonly items: (raw: TRaw) => ReadonlyArray<TItem>;
  /**
   * Returns the keys aligned with {@link items}. Defaults to an empty array when omitted.
   */
  readonly keys?: (raw: TRaw) => ReadonlyArray<string>;
  /**
   * Returns the cursor key for the next page, or undefined to stop.
   */
  readonly cursorDocumentKey?: (raw: TRaw) => Maybe<string>;
  /**
   * Overrides the "keep going" check. Defaults to `!!cursorDocumentKey(raw)`.
   */
  readonly hasMore?: (raw: TRaw) => boolean;
}

/**
 * Config for {@link iterateDbxCliCallModel}.
 *
 * Cursor-paginated iterator over a `callModel` endpoint that returns an array of
 * items. The default {@link responseAdapter} reads {@link OnCallQueryModelResult}
 * fields (`results`, `keys`, `cursorDocumentKey`, `hasMore`), so a typical
 * `call: 'query'` flow only needs to specify `modelType` and `params`. Custom
 * call shapes can override both {@link buildRequestData} and {@link responseAdapter}.
 *
 * @typeParam TParams - The request data shape passed to `callModel`.
 * @typeParam TItem - The item type yielded by the page response.
 * @typeParam TRaw - The full raw response shape. Defaults to {@link OnCallQueryModelResult}<TItem>.
 * @typeParam TItemResult - Per-item processing result type.
 * @typeParam TPageResult - Per-page processing result type.
 */
export interface IterateDbxCliCallModelConfig<TParams, TItem, TRaw = OnCallQueryModelResult<TItem>, TItemResult = void, TPageResult = void> {
  /**
   * Active CLI context (provides callModel + auth).
   */
  readonly context: CliContext;
  /**
   * Target model type, e.g. `'guestbook'`.
   */
  readonly modelType: string;
  /**
   * Call type. Defaults to `'query'`.
   */
  readonly call?: OnCallFunctionType;
  /**
   * Optional specifier passed through to `OnCallTypedModelParams`.
   */
  readonly specifier?: string;
  /**
   * Base request data merged into each page request. The iterator owns the
   * `cursorDocumentKey` field — anything else on the object (filters, parent
   * keys, etc.) is forwarded verbatim.
   */
  readonly params: TParams;
  /**
   * Override how the per-page request data is assembled. Defaults to spreading
   * `params` with `cursorDocumentKey` and (when {@link limitPerPage} or the
   * remaining {@link totalItemsLimit} budget is set) `limit` injected.
   */
  readonly buildRequestData?: (params: TParams, state: IterateDbxCliCallModelPageState, limit: Maybe<number>) => TParams;
  /**
   * Adapter for non-{@link OnCallQueryModelResult} responses.
   */
  readonly responseAdapter?: IterateDbxCliCallModelResponseAdapter<TRaw, TItem>;
  /**
   * Per-page request limit. Forwarded into the default {@link buildRequestData}.
   */
  readonly limitPerPage?: number;
  /**
   * Stop once this many items have been visited across all pages.
   */
  readonly totalItemsLimit?: number;
  /**
   * Stop after this many pages.
   */
  readonly maxPages?: number;
  /**
   * Per-item processing callback. Parallelism controlled by {@link maxParallelPerPage}.
   */
  readonly iterateItem?: IterateDbxCliCallModelItemFn<TItem, TItemResult>;
  /**
   * Per-page processing callback. Runs after {@link iterateItem} when both are set.
   */
  readonly iteratePage?: IterateDbxCliCallModelPageFn<TItem, TRaw, TItemResult, TPageResult>;
  /**
   * Concurrency knobs forwarded to `performAsyncTasks` for {@link iterateItem}.
   */
  readonly itemPerformTasksConfig?: Partial<PerformAsyncTasksConfig<TItem>>;
  /**
   * Shorthand for `itemPerformTasksConfig.maxParallelTasks`.
   */
  readonly maxParallelPerPage?: number;
  /**
   * Collect items into the result array. Defaults to true.
   */
  readonly collectItems?: boolean;
  /**
   * Collect per-item results into the result array. Defaults to true when {@link iterateItem} is set.
   */
  readonly collectItemResults?: boolean;
  /**
   * Collect per-page results into the result array. Defaults to true when {@link iteratePage} is set.
   */
  readonly collectPageResults?: boolean;
}

/**
 * Aggregate result returned by {@link iterateDbxCliCallModel}.
 */
export interface IterateDbxCliCallModelResult<TItem, TItemResult, TPageResult> {
  /**
   * Number of pages fetched.
   */
  readonly totalPages: number;
  /**
   * Number of items visited across all pages.
   */
  readonly totalItems: number;
  /**
   * True when iteration stopped because of `totalItemsLimit` / `maxPages`.
   */
  readonly hitLimit: boolean;
  /**
   * Last cursor seen. Useful for callers that want to resume later.
   */
  readonly lastCursorDocumentKey: Maybe<string>;
  /**
   * Flat list of items across all pages. Present when `collectItems !== false`.
   */
  readonly items?: ReadonlyArray<TItem>;
  /**
   * Flat list of per-item processing results. Present when {@link iterateItem} ran and `collectItemResults !== false`.
   */
  readonly itemResults?: ReadonlyArray<TItemResult>;
  /**
   * Per-page processing results. Present when {@link iteratePage} ran and `collectPageResults !== false`.
   */
  readonly pageResults?: ReadonlyArray<TPageResult>;
}

const _defaultResponseAdapter: IterateDbxCliCallModelResponseAdapter<OnCallQueryModelResult<unknown>, unknown> = {
  items: (raw) => raw.results,
  keys: (raw) => raw.keys,
  cursorDocumentKey: (raw) => raw.cursorDocumentKey,
  hasMore: (raw) => raw.hasMore
};

function _defaultBuildRequestData<TParams>(params: TParams, state: IterateDbxCliCallModelPageState, limit: Maybe<number>): TParams {
  const base = { ...(params as Record<string, unknown>) };

  if (state.cursorDocumentKey != null) {
    base.cursorDocumentKey = state.cursorDocumentKey;
  }

  if (limit != null) {
    base.limit = limit;
  }

  return base as TParams;
}

interface PageProcessingResult<TItem, TItemResult, TPageResult> {
  readonly items: ReadonlyArray<TItem>;
  readonly itemResults?: ReadonlyArray<TItemResult>;
  readonly pageResult?: TPageResult;
  readonly nextCursorDocumentKey: Maybe<string>;
  readonly hasMore: boolean;
}

async function _runItemTasks<TItem, TItemResult>(input: { readonly context: CliContext; readonly items: ReadonlyArray<TItem>; readonly keys: ReadonlyArray<string>; readonly pageIndex: number; readonly iterateItem: IterateDbxCliCallModelItemFn<TItem, TItemResult>; readonly itemPerformTasksConfig: Maybe<Partial<PerformAsyncTasksConfig<TItem>>>; readonly maxParallelPerPage: Maybe<number> }): Promise<ReadonlyArray<TItemResult>> {
  interface IndexedItem {
    readonly item: TItem;
    readonly key: string;
    readonly itemIndex: number;
  }

  const { context, items, keys, pageIndex, iterateItem, itemPerformTasksConfig, maxParallelPerPage } = input;
  const indexed: IndexedItem[] = items.map((item, itemIndex) => ({ item, key: keys[itemIndex] ?? '', itemIndex }));
  const taskConfig: PerformAsyncTasksConfig<IndexedItem> = {
    sequential: true,
    throwError: true,
    ...(itemPerformTasksConfig as Partial<PerformAsyncTasksConfig<IndexedItem>>),
    maxParallelTasks: maxParallelPerPage ?? itemPerformTasksConfig?.maxParallelTasks
  };
  const performResult = await performAsyncTasks<IndexedItem, TItemResult>(indexed, ({ item, key, itemIndex }) => iterateItem({ context, item, key, pageIndex, itemIndex }), taskConfig);

  return performResult.results.map(([, output]) => output);
}

async function _processPage<TItem, TRaw, TItemResult, TPageResult>(input: {
  readonly context: CliContext;
  readonly raw: TRaw;
  readonly pageIndex: number;
  readonly responseAdapter: IterateDbxCliCallModelResponseAdapter<TRaw, TItem>;
  readonly iterateItem: Maybe<IterateDbxCliCallModelItemFn<TItem, TItemResult>>;
  readonly iteratePage: Maybe<IterateDbxCliCallModelPageFn<TItem, TRaw, TItemResult, TPageResult>>;
  readonly itemPerformTasksConfig: Maybe<Partial<PerformAsyncTasksConfig<TItem>>>;
  readonly maxParallelPerPage: Maybe<number>;
}): Promise<PageProcessingResult<TItem, TItemResult, TPageResult>> {
  const { context, raw, pageIndex, responseAdapter, iterateItem, iteratePage, itemPerformTasksConfig, maxParallelPerPage } = input;

  const items = responseAdapter.items(raw);
  const keys = responseAdapter.keys ? responseAdapter.keys(raw) : [];
  const nextCursorDocumentKey = responseAdapter.cursorDocumentKey ? responseAdapter.cursorDocumentKey(raw) : undefined;
  const hasMore = responseAdapter.hasMore ? responseAdapter.hasMore(raw) : nextCursorDocumentKey != null;

  const itemResults = iterateItem ? await _runItemTasks({ context, items, keys, pageIndex, iterateItem, itemPerformTasksConfig, maxParallelPerPage }) : undefined;
  const pageResult = iteratePage ? await iteratePage({ context, page: raw, items, keys, pageIndex, pageItemResults: itemResults }) : undefined;

  const output: PageProcessingResult<TItem, TItemResult, TPageResult> = {
    items,
    itemResults,
    pageResult,
    nextCursorDocumentKey,
    hasMore
  };

  return output;
}

function _computeEffectiveLimit(totalItemsLimit: Maybe<number>, limitPerPage: Maybe<number>, totalItems: number): Maybe<number> {
  const remainingBudget = totalItemsLimit == null ? undefined : totalItemsLimit - totalItems;

  if (limitPerPage != null && remainingBudget != null) {
    return Math.min(limitPerPage, remainingBudget);
  }

  return limitPerPage ?? remainingBudget;
}

function _evaluateLoopExit(input: { readonly totalItemsLimit: Maybe<number>; readonly maxPages: Maybe<number>; readonly totalItems: number; readonly pageIndex: number; readonly hasMore: boolean; readonly cursorDocumentKey: Maybe<string> }): { readonly stop: boolean; readonly hitLimit: boolean } {
  const { totalItemsLimit, maxPages, totalItems, pageIndex, hasMore, cursorDocumentKey } = input;
  const reachedItemsLimit = totalItemsLimit != null && totalItems >= totalItemsLimit;
  const reachedPagesLimit = maxPages != null && pageIndex >= maxPages;

  if (reachedItemsLimit || reachedPagesLimit) {
    return { stop: true, hitLimit: true };
  }

  const exhausted = hasMore === false || cursorDocumentKey == null;
  return { stop: exhausted, hitLimit: false };
}

/**
 * Iterates a paginated `callModel` endpoint, exhausting (or stopping at the configured limit) all pages.
 *
 * Cursor-paginated analog of {@link iterateFirestoreDocumentSnapshots}, but speaking HTTP/`callModel`
 * rather than direct Firestore. The default response adapter reads the canonical
 * {@link OnCallQueryModelResult} shape — supply a custom adapter to iterate other array-returning
 * call types (e.g. a `getMultiple`-style standalone call).
 *
 * Concurrency: pages are fetched serially (cursor dependency); items within a page can run
 * in parallel via `maxParallelPerPage` (forwarded to `performAsyncTasks`).
 *
 * @example
 * ```ts
 * // Exhaust every published Guestbook entry for a single Guestbook.
 * const { totalItems, items } = await iterateDbxCliCallModel<QueryGuestbookEntriesParams, GuestbookEntry>({
 *   context,
 *   modelType: 'guestbookEntry',
 *   params: { guestbook: 'gb/abc', published: true }
 * });
 * ```
 *
 * @example
 * ```ts
 * // Fan out to a child action per Guestbook, with 4-way parallelism per page.
 * const { itemResults } = await iterateDbxCliCallModel<QueryGuestbooksParams, Guestbook, OnCallQueryModelResult<Guestbook>, EntriesForGuestbook>({
 *   context,
 *   modelType: 'guestbook',
 *   params: { published: true },
 *   maxParallelPerPage: 4,
 *   iterateItem: ({ context, key }) => queryGuestbookEntriesForGuestbook({ context, guestbook: key, published: true })
 * });
 * ```
 *
 * @param config - Iterator configuration.
 * @returns The aggregate result.
 */
export async function iterateDbxCliCallModel<TParams, TItem, TRaw = OnCallQueryModelResult<TItem>, TItemResult = void, TPageResult = void>(config: IterateDbxCliCallModelConfig<TParams, TItem, TRaw, TItemResult, TPageResult>): Promise<IterateDbxCliCallModelResult<TItem, TItemResult, TPageResult>> {
  const { context, modelType, call = 'query', specifier, params, buildRequestData = _defaultBuildRequestData<TParams>, responseAdapter = _defaultResponseAdapter as unknown as IterateDbxCliCallModelResponseAdapter<TRaw, TItem>, limitPerPage, totalItemsLimit, maxPages, iterateItem, iteratePage, itemPerformTasksConfig, maxParallelPerPage, collectItems = true, collectItemResults = iterateItem != null, collectPageResults = iteratePage != null } = config;

  const allItems: TItem[] = [];
  const allItemResults: TItemResult[] = [];
  const allPageResults: TPageResult[] = [];

  let pageIndex = 0;
  let totalItems = 0;
  let cursorDocumentKey: Maybe<string> = undefined;
  let hitLimit = false;
  let keepGoing = true;

  const collectItemsForPage = collectItems;
  const collectItemResultsForPage = iterateItem != null && collectItemResults;
  const collectPageResultsForPage = iteratePage != null && collectPageResults;

  while (keepGoing) {
    const effectiveLimit = _computeEffectiveLimit(totalItemsLimit, limitPerPage, totalItems);
    const data = buildRequestData(params, { pageIndex, cursorDocumentKey, visitedItems: totalItems }, effectiveLimit);
    const raw = await context.callModel<TParams, TRaw>({ modelType, call, specifier, data });

    const pageOutcome: PageProcessingResult<TItem, TItemResult, TPageResult> = await _processPage({
      context,
      raw,
      pageIndex,
      responseAdapter,
      iterateItem,
      iteratePage,
      itemPerformTasksConfig,
      maxParallelPerPage
    });

    if (collectItemsForPage) {
      allItems.push(...pageOutcome.items);
    }

    if (collectItemResultsForPage && pageOutcome.itemResults) {
      allItemResults.push(...pageOutcome.itemResults);
    }

    if (collectPageResultsForPage && pageOutcome.pageResult !== undefined) {
      allPageResults.push(pageOutcome.pageResult);
    }

    totalItems += pageOutcome.items.length;
    cursorDocumentKey = pageOutcome.nextCursorDocumentKey;
    pageIndex += 1;

    const exit = _evaluateLoopExit({ totalItemsLimit, maxPages, totalItems, pageIndex, hasMore: pageOutcome.hasMore, cursorDocumentKey });
    hitLimit = exit.hitLimit;
    keepGoing = !exit.stop;
  }

  const result: IterateDbxCliCallModelResult<TItem, TItemResult, TPageResult> = {
    totalPages: pageIndex,
    totalItems,
    hitLimit,
    lastCursorDocumentKey: cursorDocumentKey,
    ...(collectItemsForPage ? { items: allItems } : {}),
    ...(collectItemResultsForPage ? { itemResults: allItemResults } : {}),
    ...(collectPageResultsForPage ? { pageResults: allPageResults } : {})
  };

  return result;
}
