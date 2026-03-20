import { type Maybe, type PageNumber, type PromiseOrValue, getNextPageNumber } from '@dereekb/util';
import { fetchPageFactory, type ReadFetchPageResultInfo, type FetchPageResult, type FetchPageFactoryInputOptions, type FetchPageFactoryConfigDefaults } from '@dereekb/util/fetch';

/**
 * Base pagination parameters shared by all Zoho list/search API endpoints.
 */
export interface ZohoPageFilter {
  /**
   * 1-based page number to retrieve.
   */
  readonly page?: number;
  /**
   * Number of records to return per page.
   */
  readonly per_page?: number;
}

/**
 * Generic wrapper for Zoho API responses that return an array of records in a `data` field.
 */
export interface ZohoDataArrayResultRef<T> {
  /**
   * Array of data returned.
   */
  readonly data: T[];
}

/**
 * Paginated API response combining a data array with page metadata.
 */
export interface ZohoPageResult<T, I extends ZohoPageResultInfo = ZohoPageResultInfo> extends ZohoDataArrayResultRef<T> {
  /**
   * Pagination metadata for the current page.
   */
  readonly info: I;
}

/**
 * Creates an empty {@link ZohoPageResult} with no data and `more_records: false`.
 * Useful as a fallback when the API returns `null` instead of an empty result.
 *
 * @returns An empty page result with default pagination info
 */
export function emptyZohoPageResult<T = unknown>(): ZohoPageResult<T> {
  return {
    data: [],
    info: {
      page: 1,
      per_page: 100, // default value
      count: 0,
      more_records: false
    }
  };
}

/**
 * Pagination metadata returned by Zoho list/search API endpoints.
 */
export interface ZohoPageResultInfo {
  /**
   * Number of results being returned per page.
   */
  readonly per_page: number;
  /**
   * Number of results returned on this page.
   */
  readonly count: number;
  /**
   * The current page number.
   */
  readonly page: PageNumber;
  /**
   * Whether or not there are more records to return.
   */
  readonly more_records: boolean;
}

/**
 * Reference interface for objects that expose a {@link ZohoPageResultInfo}.
 */
export interface ZohoPageResultInfoRef {
  readonly info: ZohoPageResultInfo;
}

// MARK: Page Factory
/**
 * A fetch function that accepts paginated input and returns a {@link ZohoPageResult}.
 * Used as the underlying data source for {@link zohoFetchPageFactory}.
 */

export type ZohoFetchPageFetchFunction<I extends ZohoPageFilter, R extends ZohoPageResult<any>> = (input: I) => Promise<R>;

/**
 * Creates a page factory that wraps a Zoho fetch function with automatic pagination.
 *
 * The factory reads `info.more_records` from each response to determine if additional
 * pages exist, and automatically increments the `page` parameter for subsequent requests.
 *
 * @param fetch - The Zoho fetch function to paginate over
 * @param defaults - Optional default configuration for the page factory
 * @returns A page factory that produces iterable page fetchers
 *
 * @example
 * ```typescript
 * const pageFactory = zohoFetchPageFactory(zohoCrmSearchRecords(context));
 *
 * const fetchPage = pageFactory({ module: 'Contacts', word: 'Smith', per_page: 10 });
 * const firstPage = await fetchPage.fetchNext();
 *
 * if (firstPage.result.info.more_records) {
 *   const secondPage = await firstPage.fetchNext();
 * }
 * ```
 */
export function zohoFetchPageFactory<I extends ZohoPageFilter, R extends ZohoPageResult<any>>(fetch: ZohoFetchPageFetchFunction<I, R>, defaults?: Maybe<FetchPageFactoryConfigDefaults>) {
  return fetchPageFactory<I, R>({
    ...defaults,
    fetch,
    readFetchPageResultInfo: function (result: R): PromiseOrValue<ReadFetchPageResultInfo> {
      return {
        hasNext: result.info?.more_records ?? false // if no info is returned, assume something wrong and there are no more records
      };
    },
    buildInputForNextPage: function (pageResult: Partial<FetchPageResult<R>>, input: I, options: FetchPageFactoryInputOptions): PromiseOrValue<Maybe<Partial<I>>> {
      return { ...input, page: getNextPageNumber(pageResult), per_page: options.maxItemsPerPage ?? input.per_page };
    }
  });
}
