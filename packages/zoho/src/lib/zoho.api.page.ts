import { PageNumber } from '@dereekb/util';

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
