import { writeFileSync, appendFileSync } from 'node:fs';
import { buildDumpFilePath, getOutputOptions, pickFields } from './output';
import type { DumpMergeMode, DumpOutputMode, MultiplePagesOutputMode } from './args';

// MARK: Pagination Adapter
/**
 * Page response shape required by {@link runPaginatedList}.
 *
 * Both Zoho CRM/Recruit (`ZohoPageResult`) and Zoho Desk (`ZohoDeskPageResult`) satisfy this.
 */
export interface PaginatedResponse {
  readonly data: readonly unknown[];
  readonly info?: { readonly more_records?: boolean; readonly page?: number; readonly per_page?: number };
}

/**
 * Adapter that hides whether the underlying API is page-based (CRM/Recruit) or offset-based (Desk).
 *
 * Implementations build the next-page input, count records, and produce single-page meta.
 */
export interface PaginationAdapter<I, R extends PaginatedResponse> {
  /**
   * Returns the input for the next page, or `undefined` if no more pages exist.
   */
  nextInput(input: I, lastResult: R): I | undefined;
  /**
   * Number of records on this page.
   */
  countOf(result: R): number;
  /**
   * Meta object for single-page output (matches each command's prior meta shape).
   */
  metaOf(input: I, result: R): Record<string, unknown>;
  /**
   * Whether the response indicates more pages are available beyond this one.
   */
  hasMorePagesAvailable(input: I, result: R): boolean;
}

/**
 * Adapter for Zoho CRM and Zoho Recruit list endpoints (page-based pagination).
 *
 * Typed loosely on input so any command's literal input shape (with `page` / `per_page`
 * keys plus arbitrary other fields) satisfies the {@link PaginationAdapter} contract.
 */
export const zohoPagePaginationAdapter: PaginationAdapter<any, PaginatedResponse> = {
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
 * Desk responses have no `more_records` flag; a page that returns fewer records than `limit`
 * is treated as the final page.
 */
export const zohoDeskPaginationAdapter: PaginationAdapter<any, PaginatedResponse> = {
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

// MARK: Streaming Dump
interface StreamingDump {
  readonly mainPath?: string;
  readonly pickPath?: string;
  writePage(result: PaginatedResponse): void;
  close(): void;
}

interface OpenStreamingDumpParams {
  readonly dumpOutput: DumpOutputMode;
  readonly dumpMerge: DumpMergeMode;
}

interface WriteBothInput {
  readonly mainContent: string;
  readonly pickContent?: string;
  readonly append: boolean;
}

/**
 * Opens a streaming dump writer that flushes each page to disk on `writePage(...)`.
 *
 * When `--pick` is configured a parallel `_pick` file is also written, with the pick
 * field filter applied to each record's `data` array.
 *
 * If no dump directory is configured, returns a no-op writer.
 *
 * @param params Streaming dump configuration.
 * @returns A streaming dump writer.
 */
function openStreamingDump(params: OpenStreamingDumpParams): StreamingDump {
  const { dumpOutput, dumpMerge } = params;
  const { pick } = getOutputOptions();

  const ext: 'json' | 'ndjson' = dumpOutput === 'raw' ? 'json' : 'ndjson';
  const mainPath = buildDumpFilePath(ext);
  const pickPath = pick ? buildDumpFilePath(ext, 'pick') : undefined;

  if (!mainPath) {
    return {
      mainPath: undefined,
      pickPath: undefined,
      writePage: () => undefined,
      close: () => undefined
    };
  }

  let pagesWritten = 0;

  function applyPickToPage(result: PaginatedResponse): PaginatedResponse {
    if (!pick) {
      return result;
    }
    const pickedData = pickFields(result.data as unknown[], pick);
    return { ...result, data: pickedData };
  }

  function writeBoth(input: WriteBothInput): void {
    const flagFn = input.append ? appendFileSync : writeFileSync;
    if (mainPath) {
      flagFn(mainPath, input.mainContent);
    }
    if (pickPath && input.pickContent !== undefined) {
      flagFn(pickPath, input.pickContent);
    }
  }

  function writePage(result: PaginatedResponse): void {
    const isFirst = pagesWritten === 0;
    // For `replace` mode every iteration truncates; for `concat` mode only the first page truncates.
    const append = dumpMerge === 'concat' && !isFirst;

    if (dumpOutput === 'raw') {
      const mainContent = JSON.stringify(result, null, 2);
      const pickContent = pickPath ? JSON.stringify(applyPickToPage(result), null, 2) : undefined;
      writeBoth({ mainContent, pickContent, append });
    } else if (dumpOutput === 'page_by_line') {
      const mainContent = JSON.stringify(result) + '\n';
      const pickContent = pickPath ? JSON.stringify(applyPickToPage(result)) + '\n' : undefined;
      writeBoth({ mainContent, pickContent, append });
    } else {
      // data_by_line — one record per line. For `replace` mode, truncate on first record then append the rest.
      const records = result.data ?? [];
      const pickedRecords: unknown[] | undefined = pickPath ? (pickFields(records as unknown[], pick as string) as unknown[]) : undefined;

      if (records.length === 0) {
        // Still ensure file is created/truncated on first iteration even when empty.
        if (!append) {
          writeBoth({ mainContent: '', pickContent: pickPath ? '' : undefined, append: false });
        }
      } else {
        records.forEach((record, index) => {
          const recordAppend = append || index > 0;
          const mainContent = JSON.stringify(record) + '\n';
          const pickContent = pickPath && pickedRecords ? JSON.stringify(pickedRecords[index]) + '\n' : undefined;
          writeBoth({ mainContent, pickContent, append: recordAppend });
        });
      }
    }

    pagesWritten += 1;
  }

  return {
    mainPath,
    pickPath,
    writePage,
    close: () => undefined
  };
}

// MARK: runPaginatedList
export interface RunPaginatedListParams<I, R extends PaginatedResponse> {
  readonly initialInput: I;
  readonly fetchPage: (input: I) => Promise<R>;
  readonly adapter: PaginationAdapter<I, R>;
  readonly multiplePages: number;
  readonly multiplePagesOutput: MultiplePagesOutputMode;
  readonly dumpOutput: DumpOutputMode;
  readonly dumpMerge: DumpMergeMode;
}

export type RunPaginatedListOutcome<R extends PaginatedResponse> = { readonly handled: false; readonly result: R } | { readonly handled: true };

/**
 * Runs a list command's fetch loop with multi-page streaming support.
 *
 * - When `multiplePages <= 1` returns `{ handled: false, result }`. The caller invokes its
 *   own `outputResult(...)` to preserve the command's existing single-page meta shape exactly.
 * - When `multiplePages > 1` loops up to `multiplePages` times (or until end-of-data),
 *   streams each page to disk via {@link openStreamingDump}, prints a stdout response per
 *   `multiplePagesOutput`, and returns `{ handled: true }`.
 *
 * @param params Inputs, fetch function, adapter, and pagination/dump options.
 * @returns Single-page outcome (caller renders) or multi-page outcome (helper rendered).
 */
export async function runPaginatedList<I, R extends PaginatedResponse>(params: RunPaginatedListParams<I, R>): Promise<RunPaginatedListOutcome<R>> {
  const { initialInput, fetchPage, adapter, multiplePagesOutput, dumpOutput, dumpMerge } = params;
  const requestedPages = Math.max(1, Math.floor(params.multiplePages || 1));

  if (requestedPages <= 1) {
    const result = await fetchPage(initialInput);
    return { handled: false, result };
  }

  const outputOptions = getOutputOptions();

  if (!outputOptions.dumpDir) {
    console.error('[zoho-cli] warning: --multiple-pages used without --dump-dir; results not persisted.');
  }

  const stream = openStreamingDump({ dumpOutput, dumpMerge });

  // Accumulators for `pages` / `merged_page` stdout modes.
  // `meta` mode never accumulates; this stays empty.
  const collectedPages: R[] = [];
  const collectedRecords: unknown[] = [];
  const shouldCollectPages = multiplePagesOutput === 'pages';
  const shouldCollectRecords = multiplePagesOutput === 'merged_page';

  let input: I = initialInput;
  let pagesFetched = 0;
  let totalRecords = 0;
  let hasMorePagesAvailable = false;
  let lastResult: R | undefined;
  let lastInput: I = initialInput;

  try {
    for (let i = 0; i < requestedPages; i++) {
      const result = await fetchPage(input);
      pagesFetched += 1;
      totalRecords += adapter.countOf(result);
      lastResult = result;
      lastInput = input;

      stream.writePage(result);

      if (shouldCollectPages) {
        collectedPages.push(result);
      } else if (shouldCollectRecords) {
        for (const record of result.data ?? []) {
          collectedRecords.push(record);
        }
      }

      const next = adapter.nextInput(input, result);
      hasMorePagesAvailable = adapter.hasMorePagesAvailable(input, result);

      if (!next) {
        break;
      }

      input = next;
    }
  } finally {
    stream.close();
  }

  // Stdout per multiplePagesOutput.
  const pickFilter = outputOptions.pick;
  const summaryMeta: Record<string, unknown> = {
    pagesFetched,
    totalRecords,
    hasMorePagesAvailable,
    dumpFile: stream.mainPath ?? null
  };
  if (stream.pickPath) {
    summaryMeta.dumpFilePick = stream.pickPath;
  }

  if (multiplePagesOutput === 'meta') {
    console.log(JSON.stringify({ ok: true, meta: summaryMeta }));
  } else if (multiplePagesOutput === 'pages') {
    const data = pickFilter ? collectedPages.map((page) => ({ ...page, data: pickFields(page.data as unknown[], pickFilter) })) : collectedPages;
    console.log(JSON.stringify({ ok: true, data, meta: summaryMeta }));
  } else {
    // merged_page
    const lastMeta = lastResult ? adapter.metaOf(lastInput, lastResult) : {};
    const data = pickFilter ? pickFields(collectedRecords, pickFilter) : collectedRecords;
    console.log(JSON.stringify({ ok: true, data, meta: { ...lastMeta, ...summaryMeta } }));
  }

  return { handled: true };
}
