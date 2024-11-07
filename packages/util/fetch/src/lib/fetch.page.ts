import { CachedGetter, FIRST_PAGE, Getter, Maybe, Page, PromiseOrValue, cachedGetter, getNextPageNumber } from '@dereekb/util';
import { FetchRequestFactoryError } from './error';

export class FetchPageNoNextPageError extends FetchRequestFactoryError {
  constructor(readonly page: FetchPage<unknown, unknown>) {
    super(`There was no next page for this.`);
  }
}

export class FetchPageLimitReachedError extends FetchRequestFactoryError {
  constructor(readonly page: FetchPage<unknown, unknown>, readonly limit: number) {
    super(`The limit of ${limit} for the number of pages to read was reached.`);
  }
}

/**
 * Query/Search cursor string.
 *
 * Used by some APIs for pagination.
 */
export type FetchPageCursor = string;

export interface FetchPage<I, O> {
  /**
   * Input for this page.
   */
  readonly input: I;
  /**
   * Fetches the next page of results.
   *
   * If the page of results has been returned, returns the same reference and does not perform the fetch request again.
   *
   * If there are no pages to return, calling this will throw a FetchPageNoNextPageError error.
   */
  readonly fetchNext: CachedGetter<Promise<FetchNextPage<I, O>>>;
}

export interface FetchPageResultInfo extends Page {
  /**
   * Cursor for this page, if applicable.
   */
  readonly cursor?: Maybe<FetchPageCursor>;
  /**
   * Whether or not there are more results to fetch.
   *
   * If not defined, is assumed this info is not available and will default to true.
   *
   * Defaults to true.
   */
  readonly hasNext?: Maybe<boolean>;
}

export interface FetchPageResults<O> extends FetchPageResultInfo {
  /**
   * Result for this page.
   */
  readonly result: O;
}

export interface FetchNextPage<I, O> extends FetchPageResults<O>, FetchPage<I, O> {
  /**
   * Previous page.
   *
   * Undefined if this is the first page.
   */
  readonly previous?: Maybe<FetchNextPage<I, O>>;
  /**
   * Whether or not the max page has been reached.
   */
  readonly isAtMaxPage?: boolean;
}

export interface FetchPageFactoryConfig<I, O> {
  /**
   * The configured Fetch function that takes in the input and returns a results.
   */
  readonly fetch: (input: I) => Promise<O>;
  /**
   * Returns the page results from the result.
   *
   * The page number is ignored as it is inferred from the previous page.
   *
   * @param result
   * @returns
   */
  readonly readFetchPageResultInfo: (result: O) => PromiseOrValue<Omit<FetchPageResultInfo, 'page'>>;
  /**
   * Creates new input for the next page that is merged with the previous input.
   *
   * Returns undefined if the next page should not be loaded.
   *
   * @param result
   * @returns
   */
  readonly buildInputForNextPage: (pageResult: Partial<FetchPageResults<O>>, input: I) => PromiseOrValue<Maybe<Partial<I>>>;
  /**
   * The default max page to load up to.
   *
   * Defaults to 100. Pass null to disable the max page amount.
   */
  readonly defaultMaxPage?: Maybe<number>;
}

export interface FetchPageFactoryOptions<I, O> {
  /**
   * The max number of pages to load.
   *
   * Pass null to disable the max page amount.
   */
  readonly maxPage?: Maybe<number>;
}

/**
 * Creates a new FetchPage instance.
 */
export type FetchPageFactory<I, O> = (input: I, options?: FetchPageFactoryOptions<I, O>) => FetchPage<I, O>;

/**
 * Default max page for a FetchPageFactory.
 */
export const FETCH_PAGE_FACTORY_DEFAULT_MAX_PAGE = 100;

/**
 * Creates a new FetchPageFactory from the input.
 *
 * @param config
 * @returns
 */
export function fetchPageFactory<I, O>(config: FetchPageFactoryConfig<I, O>): FetchPageFactory<I, O> {
  const { fetch, readFetchPageResultInfo, buildInputForNextPage, defaultMaxPage } = config;

  return (initalInput: I, options?: FetchPageFactoryOptions<I, O>) => {
    const { maxPage: inputMaxPage = defaultMaxPage } = options ?? {};
    const maxPage = inputMaxPage === null ? Number.MAX_SAFE_INTEGER : inputMaxPage ?? FETCH_PAGE_FACTORY_DEFAULT_MAX_PAGE;

    function fetchNextWithInput(input: I, previous: Maybe<FetchNextPage<I, O>> = undefined): () => Promise<FetchNextPage<I, O>> {
      return async (): Promise<FetchNextPage<I, O>> => {
        const result: O = await fetch(input);
        const { cursor, hasNext: readHasNext } = await readFetchPageResultInfo(result);
        const hasNext = readHasNext !== false;
        const page = previous ? previous.page + 1 : FIRST_PAGE;
        const isAtMaxPage = page >= maxPage;

        const nextPageResult: FetchNextPage<I, O> = {
          input,
          result,
          page,
          previous,
          hasNext,
          isAtMaxPage,
          cursor,
          fetchNext: cachedGetter(async () => {
            // assert max page
            if (isAtMaxPage) {
              throw new FetchPageLimitReachedError(nextPageResult, maxPage);
            }

            // assert next page
            let nextPageInfo = hasNext ? await buildInputForNextPage(nextPageResult, input) : undefined;

            if (!nextPageInfo) {
              throw new FetchPageNoNextPageError(nextPageResult);
            }

            return fetchNextWithInput({ ...input, ...nextPageInfo }, nextPageResult)();
          })
        };

        return nextPageResult;
      };
    }

    const page: FetchPage<I, O> = {
      input: initalInput,
      fetchNext: cachedGetter(() => fetchNextWithInput(initalInput)())
    };

    return page;
  };
}
