import { type Maybe, type PromiseOrValue } from '@dereekb/util';
import { fetchPageFactory, type ReadFetchPageResultInfo, type FetchPageResult, type FetchPageFactoryInputOptions, type FetchPageFactoryConfigDefaults } from '@dereekb/util/fetch';

// MARK: Page Filter
/**
 * Pagination parameters for Zoho Sign list endpoints.
 *
 * Unlike CRM/Recruit which use `page`/`per_page`, Zoho Sign uses an offset-based
 * model with `start_index` and `row_count`.
 */
export interface ZohoSignPageFilter {
  /**
   * 1-based offset index of the first record to return.
   */
  readonly start_index?: number;
  /**
   * Number of records to return per page.
   */
  readonly row_count?: number;
  /**
   * Column to sort results by.
   */
  readonly sort_column?: ZohoSignSortColumn;
  /**
   * Sort direction.
   */
  readonly sort_order?: ZohoSignSortOrder;
}

/**
 * Known sortable column names for Zoho Sign list endpoints, with a `string` fallback for custom columns.
 */
export type ZohoSignSortColumn = 'request_name' | 'folder_name' | 'owner_full_name' | 'recipient_email' | 'form_name' | 'created_time' | string;

/**
 * Sort direction for Zoho Sign list queries.
 */
export type ZohoSignSortOrder = 'ASC' | 'DESC';

/**
 * Optional search filters for narrowing Zoho Sign document list results by specific columns.
 */
export interface ZohoSignSearchColumns {
  readonly request_name?: string;
  readonly folder_name?: string;
  readonly owner_full_name?: string;
  readonly recipient_email?: string;
  readonly recipient_name?: string;
  readonly form_name?: string;
  readonly template_name?: string;
}

// MARK: Page Context
/**
 * Pagination metadata returned by Zoho Sign list endpoints alongside each page of results.
 */
export interface ZohoSignPageContext {
  /**
   * Whether additional rows exist beyond the current page.
   */
  readonly has_more_rows: boolean;
  /**
   * Total number of records matching the query across all pages.
   */
  readonly total_count: number;
  /**
   * The 1-based offset index of the first record on this page.
   */
  readonly start_index: number;
  /**
   * Number of records returned on this page.
   */
  readonly row_count: number;
}

/**
 * Paginated response from a Zoho Sign list endpoint, containing an array of
 * request records and pagination metadata.
 */
export interface ZohoSignPageResult<T> {
  /**
   * Array of sign request records for the current page.
   */
  readonly requests: T[];
  /**
   * Pagination metadata for the current page.
   */
  readonly page_context: ZohoSignPageContext;
}

// MARK: Page Factory
/**
 * A fetch function that accepts paginated input and returns a {@link ZohoSignPageResult}.
 * Used as the underlying data source for {@link zohoSignFetchPageFactory}.
 */

export type ZohoSignFetchPageFetchFunction<I extends ZohoSignPageFilter, R extends ZohoSignPageResult<any>> = (input: I) => Promise<R>;

/**
 * Creates a page factory that wraps a Zoho Sign fetch function with automatic offset-based pagination.
 *
 * The factory reads `page_context.has_more_rows` from each response to determine if additional
 * pages exist, and automatically advances `start_index` by `row_count` for subsequent requests.
 *
 * @param fetch - The Zoho Sign fetch function to paginate over
 * @param defaults - Optional default configuration for the page factory
 * @returns A page factory that produces iterable page fetchers
 *
 * @example
 * ```typescript
 * const pageFactory = zohoSignFetchPageFactory(zohoSignGetDocumentsList(context));
 *
 * const fetchPage = pageFactory({ row_count: 10 });
 * const firstPage = await fetchPage.fetchNext();
 *
 * if (firstPage.result.page_context.has_more_rows) {
 *   const secondPage = await firstPage.fetchNext();
 * }
 * ```
 */
export function zohoSignFetchPageFactory<I extends ZohoSignPageFilter, R extends ZohoSignPageResult<any>>(fetch: ZohoSignFetchPageFetchFunction<I, R>, defaults?: Maybe<FetchPageFactoryConfigDefaults>) {
  return fetchPageFactory<I, R>({
    ...defaults,
    fetch,
    readFetchPageResultInfo: function (result: R): PromiseOrValue<ReadFetchPageResultInfo> {
      return {
        hasNext: result.page_context?.has_more_rows ?? false
      };
    },
    buildInputForNextPage: function (pageResult: Partial<FetchPageResult<R>>, input: I, options: FetchPageFactoryInputOptions): PromiseOrValue<Maybe<Partial<I>>> {
      const previousResult = pageResult.result;
      const previousPageContext = previousResult?.page_context;
      const rowCount = options.maxItemsPerPage ?? input.row_count ?? previousPageContext?.row_count ?? 20;
      const nextStartIndex = (previousPageContext?.start_index ?? input.start_index ?? 1) + rowCount;

      return { ...input, start_index: nextStartIndex, row_count: rowCount } as Partial<I>;
    }
  });
}
