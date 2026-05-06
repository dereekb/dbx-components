import { type PaginatedResponse, type PaginationAdapter } from '@dereekb/dbx-cli';

export { type PaginatedResponse, type PaginationAdapter, type RunPaginatedListOutcome, type RunPaginatedListParams, type StreamingDump, openStreamingDump, runPaginatedList } from '@dereekb/dbx-cli';

/**
 * Zoho-specific extension of {@link PaginatedResponse} that exposes the `info` block returned
 * by Zoho CRM/Recruit list endpoints. Used by {@link zohoPagePaginationAdapter} to detect
 * end-of-data and to derive single-page meta.
 */
export interface ZohoPaginatedResponse extends PaginatedResponse {
  readonly info?: { readonly more_records?: boolean; readonly page?: number; readonly per_page?: number };
}

/**
 * Adapter for Zoho CRM and Zoho Recruit list endpoints (page-based pagination).
 *
 * Typed loosely on input so any command's literal input shape (with `page` / `per_page` keys plus
 * arbitrary other fields) satisfies the {@link PaginationAdapter} contract.
 */
export const zohoPagePaginationAdapter: PaginationAdapter<any, ZohoPaginatedResponse> = {
  nextInput: (input, last) => {
    if (!last.info?.more_records) {
      return undefined;
    }

    const currentPage = (input as { page?: number }).page ?? 1;
    return { ...input, page: currentPage + 1 };
  },
  countOf: (r) => r.data?.length ?? 0,
  metaOf: (input, r) => ({
    page: r.info?.page ?? (input as { page?: number }).page,
    per_page: r.info?.per_page ?? (input as { per_page?: number }).per_page,
    more_records: r.info?.more_records ?? false
  }),
  hasMorePagesAvailable: (_input, r) => r.info?.more_records ?? false
};

/**
 * Adapter for Zoho Desk list endpoints (offset-based pagination).
 *
 * Desk responses have no `more_records` flag; a page that returns fewer records than `limit` is
 * treated as the final page.
 */
export const zohoDeskPaginationAdapter: PaginationAdapter<any, ZohoPaginatedResponse> = {
  nextInput: (input, last) => {
    const limit = (input as { limit?: number }).limit ?? 25;

    if (limit <= 0) {
      return undefined;
    }

    const count = last.data?.length ?? 0;

    if (count < limit) {
      return undefined;
    }

    const currentFrom = (input as { from?: number }).from ?? 1;
    return { ...input, from: currentFrom + limit };
  },
  countOf: (r) => r.data?.length ?? 0,
  metaOf: (input, r) => ({
    from: (input as { from?: number }).from,
    limit: (input as { limit?: number }).limit,
    count: r.data?.length ?? 0
  }),
  hasMorePagesAvailable: (input, r) => {
    const limit = (input as { limit?: number }).limit ?? 25;

    if (limit <= 0) {
      return false;
    }

    const count = r.data?.length ?? 0;
    return count >= limit;
  }
};
