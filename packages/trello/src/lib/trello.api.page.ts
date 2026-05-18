import { type Maybe, type PromiseOrValue } from '@dereekb/util';
import { fetchPageFactory, type FetchPageFactory, type FetchPageFactoryConfigDefaults, type FetchPageFactoryInputOptions, type FetchPageResult, type ReadFetchPageResultInfo } from '@dereekb/util/fetch';
import { type TrelloActionId, type TrelloId } from './trello.type';

/**
 * Maximum allowed `limit` value for most Trello collection endpoints.
 *
 * @see https://developer.atlassian.com/cloud/trello/rest/
 */
export const TRELLO_MAX_PAGE_LIMIT = 1000;

/**
 * Filter shape for Trello cursor-style pagination using action IDs.
 *
 * Trello collection endpoints typically accept `before`/`since` filters that take an item id
 * (often an action id or card id) and return items older/newer than that cursor.
 */
export interface TrelloCursorPageFilter {
  /**
   * Returns items before this id (older).
   */
  readonly before?: TrelloId;
  /**
   * Returns items since this id (newer).
   */
  readonly since?: TrelloId;
  /**
   * Maximum number of items to return. Defaults vary per endpoint; max is typically 1000.
   */
  readonly limit?: number;
}

/**
 * A Trello collection endpoint typically returns a bare JSON array.
 *
 * This type captures pagination metadata around such a response.
 */
export interface TrelloPageResult<T> {
  /**
   * The page data.
   */
  readonly data: ReadonlyArray<T>;
  /**
   * Maximum items requested for this page (echoed from input).
   */
  readonly limit: number;
  /**
   * Cursor that can be used as `before` to fetch the next (older) page.
   *
   * Undefined when this page has fewer items than the requested limit.
   */
  readonly nextBefore?: TrelloId;
}

/**
 * Reads the id of the last item in a Trello page response, for use as the next page's `before` cursor.
 */
export type TrelloPageItemIdReader<T> = (item: T) => TrelloId;

/**
 * Default reader that pulls `id` off the item. Works for most Trello resource types.
 *
 * @param item - The page item whose id to read.
 * @returns The item's id.
 */
export const defaultTrelloPageItemIdReader = <T extends { readonly id: TrelloId }>(item: T): TrelloId => item.id;

/**
 * Reader that pulls the action id off a Trello action item.
 *
 * @param item - The action page item whose id to read.
 * @returns The item's action id.
 */
export const trelloActionIdReader = <T extends { readonly id: TrelloActionId }>(item: T): TrelloActionId => item.id;

/**
 * Wraps a raw Trello collection fetch into a {@link TrelloPageResult}.
 *
 * @param input - The page filter that was used.
 * @param data - The raw page items.
 * @param idReader - Function to read the id from the last item.
 * @returns A page result with the data and a cursor for the next page.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function buildTrelloPageResult<T>(input: TrelloCursorPageFilter, data: ReadonlyArray<T>, idReader: TrelloPageItemIdReader<T>): TrelloPageResult<T> {
  const limit = input.limit ?? data.length;
  const hasMore = data.length === limit && data.length > 0;
  const lastItem = hasMore ? data.at(-1) : undefined;
  const nextBefore = lastItem === undefined ? undefined : idReader(lastItem);

  return {
    data,
    limit,
    nextBefore
  };
}

export type TrelloFetchPageFetchFunction<I extends TrelloCursorPageFilter, R extends TrelloPageResult<unknown>> = (input: I) => Promise<R>;

/**
 * Creates a FetchPageFactory using the input TrelloFetchPageFetchFunction.
 *
 * @param fetch - Function that fetches a single page of results from the Trello API.
 * @param defaults - Optional default pagination configuration.
 * @returns A configured FetchPageFactory that handles Trello's cursor-based pagination using `before`.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function trelloFetchPageFactory<I extends TrelloCursorPageFilter, R extends TrelloPageResult<unknown>>(fetch: TrelloFetchPageFetchFunction<I, R>, defaults?: Maybe<FetchPageFactoryConfigDefaults>): FetchPageFactory<I, R> {
  return fetchPageFactory<I, R>({
    ...defaults,
    fetch,
    readFetchPageResultInfo: (result: R): PromiseOrValue<ReadFetchPageResultInfo> => ({
      nextPageCursor: result.nextBefore,
      hasNext: Boolean(result.nextBefore)
    }),
    buildInputForNextPage: (pageResult: Partial<FetchPageResult<R>>, input: I, options: FetchPageFactoryInputOptions): PromiseOrValue<Maybe<Partial<I>>> => ({
      ...input,
      before: pageResult.nextPageCursor,
      limit: options.maxItemsPerPage ?? input.limit
    })
  });
}
