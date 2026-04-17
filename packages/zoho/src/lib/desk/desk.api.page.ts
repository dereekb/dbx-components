import { type Maybe, type PromiseOrValue } from '@dereekb/util';
import { fetchPageFactory, type ReadFetchPageResultInfo, type FetchPageResult, type FetchPageFactoryInputOptions, type FetchPageFactoryConfigDefaults } from '@dereekb/util/fetch';
import { type ZohoDeskSortOrder } from './desk';

// MARK: Page Filter
/**
 * Maximum number of records per page for Zoho Desk list endpoints.
 */
export const ZOHO_DESK_MAX_PAGE_LIMIT = 50;

/**
 * Default number of records per page for Zoho Desk list endpoints.
 */
export const ZOHO_DESK_DEFAULT_PAGE_LIMIT = 25;

/**
 * Pagination parameters for Zoho Desk list endpoints.
 *
 * Unlike CRM/Recruit which use `page`/`per_page`, Zoho Desk uses an offset-based
 * model with `from` (1-based offset) and `limit` (max 50).
 */
export interface ZohoDeskPageFilter {
  /**
   * 1-based offset index of the first record to return.
   *
   * Defaults to 1.
   */
  readonly from?: number;
  /**
   * Number of records to return per page.
   *
   * Defaults to {@link ZOHO_DESK_DEFAULT_PAGE_LIMIT}. Maximum is {@link ZOHO_DESK_MAX_PAGE_LIMIT}.
   */
  readonly limit?: number;
  /**
   * Sort direction for results.
   */
  readonly sortOrder?: ZohoDeskSortOrder;
}

// MARK: Page Result
/**
 * Paginated response from a Zoho Desk list endpoint.
 *
 * Zoho Desk returns records as a plain array in the `data` key.
 * Unlike CRM, there is no `more_records` metadata; pagination is determined
 * by comparing the returned array length against the requested limit.
 */
export interface ZohoDeskPageResult<T> {
  /**
   * Array of records for the current page.
   */
  readonly data: T[];
}

// MARK: Page Factory
/**
 * A fetch function that accepts paginated input and returns a {@link ZohoDeskPageResult}.
 * Used as the underlying data source for {@link zohoDeskFetchPageFactory}.
 */
export type ZohoDeskFetchPageFetchFunction<I extends ZohoDeskPageFilter, R extends ZohoDeskPageResult<any>> = (input: I) => Promise<R>;

/**
 * Creates a page factory that wraps a Zoho Desk fetch function with automatic offset-based pagination.
 *
 * The factory determines whether additional pages exist by comparing the number of returned records
 * against the requested `limit`. If `data.length >= limit`, more records are assumed to exist.
 * The `from` offset is automatically advanced by `limit` for subsequent requests.
 *
 * @param fetch - The Zoho Desk fetch function to paginate over
 * @param defaults - Optional default configuration for the page factory
 * @returns A page factory that produces iterable page fetchers
 *
 * @example
 * ```typescript
 * const pageFactory = zohoDeskFetchPageFactory(zohoDeskGetTickets(context));
 *
 * const fetchPage = pageFactory({ limit: 25 });
 * const firstPage = await fetchPage.fetchNext();
 *
 * if (firstPage.result.data.length >= 25) {
 *   const secondPage = await firstPage.fetchNext();
 * }
 * ```
 */
export function zohoDeskFetchPageFactory<I extends ZohoDeskPageFilter, R extends ZohoDeskPageResult<any>>(fetch: ZohoDeskFetchPageFetchFunction<I, R>, defaults?: Maybe<FetchPageFactoryConfigDefaults>) {
  return fetchPageFactory<I, R>({
    ...defaults,
    fetch,
    readFetchPageResultInfo: function (result: R): PromiseOrValue<ReadFetchPageResultInfo> {
      const dataLength = result.data?.length ?? 0;
      return {
        hasNext: dataLength > 0 && dataLength >= ZOHO_DESK_DEFAULT_PAGE_LIMIT
      };
    },
    buildInputForNextPage: function (pageResult: Partial<FetchPageResult<R>>, input: I, options: FetchPageFactoryInputOptions): PromiseOrValue<Maybe<Partial<I>>> {
      const limit = options.maxItemsPerPage ?? input.limit ?? ZOHO_DESK_DEFAULT_PAGE_LIMIT;
      const previousFrom = input.from ?? 1;
      const nextFrom = previousFrom + limit;

      return { ...input, from: nextFrom, limit } as Partial<I>;
    }
  });
}
