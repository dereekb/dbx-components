import { type Maybe, type PageNumber, type PromiseOrValue } from '@dereekb/util';
import { fetchPageFactory, type ReadFetchPageResultInfo, type FetchPageResult, type FetchPageFactoryInputOptions, type FetchPageFactoryConfigDefaults } from '@dereekb/util/fetch';

/**
 * Base page filter
 */
export interface ZoomPageFilter {
  readonly page_number?: number;
  readonly page_size?: number;
  readonly next_page_token?: string;
}

export type MapToZoomPageResultFunction<T> = (data: any) => ZoomPageResult<T>;

/**
 * The Zoom API returns the data for a page for a specific key. 
 * 
 * This function maps the data under that key to a ZoomPageResult with the data on the "data" variable.
 
 * @param dataTypeKey 
 * @returns 
 */
export function mapToZoomPageResult<T>(dataTypeKey: string): MapToZoomPageResultFunction<T> {
  return (data: any) => {
    const { next_page_token, page_count, page_number, page_size, total_records } = data;

    return {
      data: data[dataTypeKey],
      next_page_token,
      page_count,
      page_number,
      page_size,
      total_records
    };
  };
}

export interface ZoomDataArrayResultRef<T> {
  /**
   * Array of data returned.
   */
  readonly data: T[];
}

/**
 * Page result that contains an array of data and page information.
 */
export interface ZoomPageResult<T> extends ZoomDataArrayResultRef<T>, ZoomPageResultInfo {}

/**
 * Cursor for pagination.
 */
export type ZoomPageResultToken = string;

/**
 * Page information within a ZoomPageResult
 */
export interface ZoomPageResultInfo {
  /**
   * Use the next page token to paginate through large result sets. A next page token will be returned whenever the set of available results exceeds the current page size. This token's expiration period is 15 minutes.
   */
  readonly next_page_token: ZoomPageResultToken;
  /**
   * The number of pages returned for the request made.
   *
   * Possibly undefined for some calls.
   */
  readonly page_count?: number | undefined;
  /**
   * The page number of the current results.
   *
   * Possibly undefined for some calls.
   */
  readonly page_number?: PageNumber | undefined;
  /**
   * The number of records returned with a single API call.
   */
  readonly page_size: number;
  /**
   * The total number of all the records available across pages.
   */
  readonly total_records: number;
}

// MARK: Page Factory
export type ZoomFetchPageFetchFunction<I extends ZoomPageFilter, R extends ZoomPageResult<any>> = (input: I) => Promise<R>;

/**
 * Creates a FetchPageFactory using the input ZoomFetchPageFetchFunction.
 *
 * @param fetch
 * @param defaults
 * @returns
 */
export function zoomFetchPageFactory<I extends ZoomPageFilter, R extends ZoomPageResult<any>>(fetch: ZoomFetchPageFetchFunction<I, R>, defaults?: Maybe<FetchPageFactoryConfigDefaults>) {
  return fetchPageFactory<I, R>({
    ...defaults,
    fetch,
    readFetchPageResultInfo: function (result: R): PromiseOrValue<ReadFetchPageResultInfo> {
      return {
        nextPageCursor: result.next_page_token,
        hasNext: Boolean(result.next_page_token) // has more when a non-empty next_page_token is returned
      };
    },
    buildInputForNextPage: function (pageResult: Partial<FetchPageResult<R>>, input: I, options: FetchPageFactoryInputOptions): PromiseOrValue<Maybe<Partial<I>>> {
      return { ...input, next_page_token: pageResult.nextPageCursor, page_size: options.maxItemsPerPage ?? input.page_size };
    }
  });
}
