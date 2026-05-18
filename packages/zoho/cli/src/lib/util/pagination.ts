import { outputResult, type PaginatedResponse, type PaginationAdapter, runPaginatedList } from '@dereekb/dbx-cli';

// eslint-disable-next-line dereekb-util/no-sister-re-export -- backward-compatible facade so zoho-cli consumers keep the existing pagination import surface
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
    let next: typeof input | undefined;

    if (!last.info?.more_records) {
      next = undefined;
    } else {
      const currentPage = (input as { page?: number }).page ?? 1;
      next = { ...input, page: currentPage + 1 };
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
export const zohoDeskPaginationAdapter: PaginationAdapter<any, ZohoPaginatedResponse> = {
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
 * Wires {@link runPaginatedList} with {@link zohoPagePaginationAdapter} and,
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
    adapter: zohoPagePaginationAdapter,
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
