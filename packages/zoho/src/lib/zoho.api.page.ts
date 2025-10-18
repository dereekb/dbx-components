import { type Maybe, type PageNumber, type PromiseOrValue, getNextPageNumber } from '@dereekb/util';
import { fetchPageFactory, type ReadFetchPageResultInfo, type FetchPageResult, type FetchPageFactoryInputOptions, type FetchPageFactoryConfigDefaults } from '@dereekb/util/fetch';

/**
 * Base page filter
 */
export interface ZohoPageFilter {
  readonly page?: number;
  readonly per_page?: number;
}

export interface ZohoDataArrayResultRef<T> {
  /**
   * Array of data returned.
   */
  readonly data: T[];
}

/**
 * Page result that contains an array of data and page information.
 */
export interface ZohoPageResult<T, I extends ZohoPageResultInfo = ZohoPageResultInfo> extends ZohoDataArrayResultRef<T> {
  /**
   * Current page information
   */
  readonly info: I;
}

/**
 * Returns an empty ZohoPageResult that is typed to R and has no more records/results.
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
 * Page information within a ZohoPageResult
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
 * Reference to a ZohoPageResultInfo value
 */
export interface ZohoPageResultInfoRef {
  readonly info: ZohoPageResultInfo;
}

// MARK: Page Factory
export type ZohoFetchPageFetchFunction<I extends ZohoPageFilter, R extends ZohoPageResult<any>> = (input: I) => Promise<R>;

/**
 * Creates a FetchPageFactory using the input ZohoFetchPageFetchFunction.
 *
 * @param fetch
 * @param defaults
 * @returns
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
