import { type Maybe, type PromiseOrValue } from '@dereekb/util';
import { fetchPageFactory, type ReadFetchPageResultInfo, type FetchPageResult, type FetchPageFactoryInputOptions, type FetchPageFactoryConfigDefaults } from '@dereekb/util/fetch';

// MARK: Page Filter
/**
 * Zoho Sign pagination filter input.
 *
 * Uses start_index/row_count instead of page/per_page.
 */
export interface ZohoSignPageFilter {
  readonly start_index?: number;
  readonly row_count?: number;
  readonly sort_column?: ZohoSignSortColumn;
  readonly sort_order?: ZohoSignSortOrder;
}

export type ZohoSignSortColumn = 'request_name' | 'folder_name' | 'owner_full_name' | 'recipient_email' | 'form_name' | 'created_time' | string;
export type ZohoSignSortOrder = 'ASC' | 'DESC';

/**
 * Search columns for filtering the document list.
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
 * Page context returned by Zoho Sign list endpoints.
 */
export interface ZohoSignPageContext {
  readonly has_more_rows: boolean;
  readonly total_count: number;
  readonly start_index: number;
  readonly row_count: number;
}

/**
 * Page result containing an array of requests and pagination context.
 */
export interface ZohoSignPageResult<T> {
  readonly requests: T[];
  readonly page_context: ZohoSignPageContext;
}

// MARK: Page Factory
export type ZohoSignFetchPageFetchFunction<I extends ZohoSignPageFilter, R extends ZohoSignPageResult<any>> = (input: I) => Promise<R>;

/**
 * Creates a FetchPageFactory for Zoho Sign's start_index/row_count pagination model.
 *
 * @param fetch
 * @param defaults
 * @returns
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
