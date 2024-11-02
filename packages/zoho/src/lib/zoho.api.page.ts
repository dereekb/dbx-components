import { PageNumber } from '@dereekb/util';

/**
 * Page result that contains an array of data and page information.
 */
export interface ZohoPageResult<T> {
  /**
   * Array of data returned.
   */
  readonly data: T[];
  /**
   * Current page information
   */
  readonly info: ZohoPageResultInfo;
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
