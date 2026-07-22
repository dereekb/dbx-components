import { outputResult, type PaginatedResponse, type PaginationAdapter, runPaginatedList } from '@dereekb/dbx-cli';

// eslint-disable-next-line dereekb-util/no-sister-re-export -- backward-compatible facade so zoho-cli consumers keep the existing pagination import surface
export { type PaginatedResponse, type PaginationAdapter, type RunPaginatedListOutcome, type RunPaginatedListParams, type StreamingDump, openStreamingDump, runPaginatedList } from '@dereekb/dbx-cli';

/**
 * Zoho-specific extension of {@link PaginatedResponse} that exposes the `info` block returned
 * by Zoho CRM/Recruit list endpoints. Used by {@link ZOHO_PAGE_PAGINATION_ADAPTER} to detect
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
export const ZOHO_PAGE_PAGINATION_ADAPTER: PaginationAdapter<any, ZohoPaginatedResponse> = {
  nextInput: (input, last) => {
    let next: typeof input | undefined;

    if (last.info?.more_records) {
      const currentPage = (input as { page?: number }).page ?? 1;
      next = { ...input, page: currentPage + 1 };
    } else {
      next = undefined;
    }

    return next;
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
export const ZOHO_DESK_PAGINATION_ADAPTER: PaginationAdapter<any, ZohoPaginatedResponse> = {
  nextInput: (input, last) => {
    const limit = (input as { limit?: number }).limit ?? 25;
    const count = last.data?.length ?? 0;
    let next: typeof input | undefined;

    if (limit <= 0 || count < limit) {
      next = undefined;
    } else {
      const currentFrom = (input as { from?: number }).from ?? 1;
      next = { ...input, from: currentFrom + limit };
    }

    return next;
  },
  countOf: (r) => r.data?.length ?? 0,
  metaOf: (input, r) => ({
    from: (input as { from?: number }).from,
    limit: (input as { limit?: number }).limit,
    count: r.data?.length ?? 0
  }),
  hasMorePagesAvailable: (input, r) => {
    const limit = (input as { limit?: number }).limit ?? 25;
    const count = r.data?.length ?? 0;
    return limit > 0 && count >= limit;
  }
};

/**
 * Pagination metadata returned by Zoho Sign list endpoints (the `page_context` block).
 */
export interface ZohoSignPageContextMeta {
  readonly has_more_rows?: boolean;
  readonly total_count?: number;
  readonly start_index?: number;
  readonly row_count?: number;
}

/**
 * Zoho-Sign-specific extension of {@link PaginatedResponse}. Zoho Sign list endpoints return their
 * records under `requests` and their pagination cursor under `page_context`; {@link runZohoSignPaginatedList}
 * remaps `requests` onto the required `data` field before pagination so the shared engine can read it,
 * while the adapter inspects `page_context` for cursor advancement.
 */
export interface ZohoSignPaginatedResponse extends PaginatedResponse {
  readonly page_context?: ZohoSignPageContextMeta;
}

/**
 * Adapter for Zoho Sign list endpoints (offset-based pagination via `start_index`/`row_count`).
 *
 * Zoho Sign reports whether more rows exist through `page_context.has_more_rows` and advances by
 * incrementing `start_index` by `row_count`. Typed loosely on input so any command's literal input
 * shape (with `start_index` / `row_count` plus arbitrary other fields) satisfies the contract.
 */
export const ZOHO_SIGN_PAGINATION_ADAPTER: PaginationAdapter<any, ZohoSignPaginatedResponse> = {
  nextInput: (input, last) => {
    let next: typeof input | undefined;

    if (last.page_context?.has_more_rows) {
      const rowCount = (input as { row_count?: number }).row_count ?? last.page_context?.row_count ?? 20;
      const currentStartIndex = (input as { start_index?: number }).start_index ?? last.page_context?.start_index ?? 1;
      next = { ...input, start_index: currentStartIndex + rowCount };
    } else {
      next = undefined;
    }

    return next;
  },
  countOf: (r) => r.data?.length ?? 0,
  metaOf: (input, r) => ({
    start_index: r.page_context?.start_index ?? (input as { start_index?: number }).start_index,
    row_count: r.page_context?.row_count ?? (input as { row_count?: number }).row_count,
    total_count: r.page_context?.total_count,
    has_more_rows: r.page_context?.has_more_rows ?? false
  }),
  hasMorePagesAvailable: (_input, r) => r.page_context?.has_more_rows ?? false
};

/**
 * Input to {@link runZohoPaginatedList}.
 *
 * `argv` is intentionally typed as `any` to match the per-command
 * `handler: async (argv: any)` convention every Zoho CLI command file uses.
 * The runner only reads the four pagination/dump flags off it and forwards
 * them to {@link runPaginatedList}, which validates them.
 */
export interface RunZohoPaginatedListInput<TInput, TResponse extends ZohoPaginatedResponse> {
  readonly argv: any;
  readonly initialInput: TInput;
  readonly fetchPage: (input: TInput) => Promise<TResponse>;
}

/**
 * Convenience runner for Zoho CRM/Recruit list-style commands.
 *
 * Wires {@link runPaginatedList} with {@link ZOHO_PAGE_PAGINATION_ADAPTER} and,
 * when the call resolves to a single-page response, prints the standard
 * `data` + `{page, per_page, more_records}` meta envelope every command in
 * those CLIs uses. Multi-page invocations are streamed/printed by
 * `runPaginatedList` itself so this helper is a no-op in that branch.
 *
 * @param input - Argv (the yargs-typed handler argv), the per-command
 *   `initialInput` payload, and the fetcher that issues the underlying API
 *   call.
 */
export async function runZohoPaginatedList<TInput, TResponse extends ZohoPaginatedResponse>(input: RunZohoPaginatedListInput<TInput, TResponse>): Promise<void> {
  const { argv, initialInput, fetchPage } = input;
  const outcome = await runPaginatedList({
    initialInput,
    fetchPage,
    adapter: ZOHO_PAGE_PAGINATION_ADAPTER,
    multiplePages: argv.multiplePages,
    multiplePagesOutput: argv.multiplePagesOutput,
    dumpOutput: argv.dumpOutput,
    dumpMerge: argv.dumpMerge
  });
  if (outcome.handled === false) {
    const result = outcome.result;
    outputResult(result.data, { page: result.info?.page, per_page: result.info?.per_page, more_records: result.info?.more_records });
  }
}

/**
 * Raw Zoho Sign list response shape: records under `requests`, cursor under `page_context`.
 */
export interface ZohoSignListResponse {
  readonly requests?: readonly unknown[];
  readonly page_context?: ZohoSignPageContextMeta;
}

/**
 * Input to {@link runZohoSignPaginatedList}.
 *
 * `fetchPage` returns the raw Zoho Sign list shape (`requests` + `page_context`); the runner remaps
 * `requests` onto the `data` field the shared pagination engine requires. `argv` is typed as `any`
 * to match the per-command `handler: async (argv: any)` convention.
 */
export interface RunZohoSignPaginatedListInput<TInput> {
  readonly argv: any;
  readonly initialInput: TInput;
  readonly fetchPage: (input: TInput) => Promise<ZohoSignListResponse>;
}

/**
 * Convenience runner for Zoho Sign list-style commands (documents, templates).
 *
 * Wraps {@link runPaginatedList} with {@link ZOHO_SIGN_PAGINATION_ADAPTER}, remapping each raw Sign
 * response's `requests` array onto the `data` field the engine reads. On a single-page invocation it
 * prints the standard `data` + `{ start_index, row_count, total_count, has_more_rows }` meta envelope;
 * multi-page invocations are streamed/printed by `runPaginatedList` itself.
 *
 * @param input - Argv (the yargs-typed handler argv), the per-command `initialInput` payload, and the
 *   fetcher that issues the underlying Sign API call.
 */
export async function runZohoSignPaginatedList<TInput>(input: RunZohoSignPaginatedListInput<TInput>): Promise<void> {
  const { argv, initialInput, fetchPage } = input;
  const outcome = await runPaginatedList<TInput, ZohoSignPaginatedResponse>({
    initialInput,
    fetchPage: async (pageInput) => {
      const response = await fetchPage(pageInput);
      return { data: response.requests ?? [], page_context: response.page_context };
    },
    adapter: ZOHO_SIGN_PAGINATION_ADAPTER,
    multiplePages: argv.multiplePages,
    multiplePagesOutput: argv.multiplePagesOutput,
    dumpOutput: argv.dumpOutput,
    dumpMerge: argv.dumpMerge
  });

  if (outcome.handled === false) {
    const result = outcome.result;
    outputResult(result.data, { start_index: result.page_context?.start_index, row_count: result.page_context?.row_count, total_count: result.page_context?.total_count, has_more_rows: result.page_context?.has_more_rows ?? false });
  }
}
