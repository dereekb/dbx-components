import { writeFileSync, appendFileSync } from 'node:fs';
import { type Maybe } from '@dereekb/util';
import { buildDumpFilePath, getOutputOptions, pickFields } from './output';
import { type DumpMergeMode, type DumpOutputMode, type MultiplePagesOutputMode } from './args';

// MARK: Pagination Adapter
/**
 * Minimal page response shape required by {@link runPaginatedList}.
 *
 * Engine consumers extend this with whatever provider-specific fields their adapter inspects
 * (e.g. Zoho CRM/Recruit responses add `info.more_records`).
 */
export interface PaginatedResponse {
  readonly data: readonly unknown[];
}

/**
 * Adapter that hides the underlying API's pagination scheme (page-based, offset-based, cursor-based, etc.).
 *
 * Implementations build the next-page input, count records, and produce single-page meta.
 */
export interface PaginationAdapter<I, R extends PaginatedResponse> {
  /**
   * Returns the input for the next page, or `undefined` if no more pages exist.
   */
  nextInput(input: I, lastResult: R): Maybe<I>;
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

// MARK: Streaming Dump
export interface StreamingDump {
  readonly mainPath: Maybe<string>;
  readonly pickPath: Maybe<string>;
  writePage(result: PaginatedResponse): void;
  close(): void;
}

export interface OpenStreamingDumpParams {
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
 * When `--pick` is configured, a parallel `_pick` file is also written with the pick filter
 * applied to each record's `data` array. If no dump directory is configured, returns a no-op writer.
 *
 * @param params - Streaming dump configuration.
 * @param params.dumpOutput - Per-page dump format (`raw`, `page_by_line`, or `data_by_line`).
 * @param params.dumpMerge - Across-pages dump merge mode (`replace` truncates each iteration; `concat` appends).
 * @returns The {@link StreamingDump} writer (a no-op when no `dumpDir` is configured).
 */
export function openStreamingDump(params: OpenStreamingDumpParams): StreamingDump {
  const { dumpOutput, dumpMerge } = params;
  const { pick } = getOutputOptions();

  const ext: 'json' | 'ndjson' = dumpOutput === 'raw' ? 'json' : 'ndjson';
  const mainPath = buildDumpFilePath(ext);
  const pickPath = pick ? buildDumpFilePath(ext, 'pick') : undefined;
  let dump: StreamingDump;

  if (!mainPath) {
    dump = {
      mainPath: undefined,
      pickPath: undefined,
      writePage: () => undefined,
      close: () => undefined
    };
  } else {
    let pagesWritten = 0;

    const applyPickToPage = (result: PaginatedResponse): PaginatedResponse => {
      let mapped: PaginatedResponse;
      if (!pick) {
        mapped = result;
      } else {
        const pickedData = pickFields(result.data as unknown[], pick);
        mapped = { ...result, data: pickedData };
      }
      return mapped;
    };

    const writeBoth = (input: WriteBothInput): void => {
      const flagFn = input.append ? appendFileSync : writeFileSync;

      if (mainPath) {
        flagFn(mainPath, input.mainContent);
      }

      if (pickPath && input.pickContent !== undefined) {
        flagFn(pickPath, input.pickContent);
      }
    };

    const writeRawPage = (result: PaginatedResponse, append: boolean): void => {
      const mainContent = JSON.stringify(result, null, 2);
      const pickContent = pickPath ? JSON.stringify(applyPickToPage(result), null, 2) : undefined;
      writeBoth({ mainContent, pickContent, append });
    };

    const writeLinePage = (result: PaginatedResponse, append: boolean): void => {
      const mainContent = JSON.stringify(result) + '\n';
      const pickContent = pickPath ? JSON.stringify(applyPickToPage(result)) + '\n' : undefined;
      writeBoth({ mainContent, pickContent, append });
    };

    const writeDataByLinePage = (result: PaginatedResponse, append: boolean): void => {
      // data_by_line — one record per line. For `replace` mode, truncate on first record then append the rest.
      const records = result.data ?? [];
      const pickedRecords: Maybe<unknown[]> = pickPath ? (pickFields(records as unknown[], pick as string) as unknown[]) : undefined;

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
    };

    const writePage = (result: PaginatedResponse): void => {
      const isFirst = pagesWritten === 0;
      // For `replace` mode every iteration truncates; for `concat` mode only the first page truncates.
      const append = dumpMerge === 'concat' && !isFirst;

      if (dumpOutput === 'raw') {
        writeRawPage(result, append);
      } else if (dumpOutput === 'page_by_line') {
        writeLinePage(result, append);
      } else {
        writeDataByLinePage(result, append);
      }

      pagesWritten += 1;
    };

    dump = {
      mainPath,
      pickPath,
      writePage,
      close: () => undefined
    };
  }

  return dump;
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

interface FetchLoopState<I, R extends PaginatedResponse> {
  pagesFetched: number;
  totalRecords: number;
  hasMorePagesAvailable: boolean;
  lastResult: Maybe<R>;
  lastInput: I;
  collectedPages: R[];
  collectedRecords: unknown[];
}

interface FetchLoopInput<I, R extends PaginatedResponse> {
  readonly initialInput: I;
  readonly requestedPages: number;
  readonly fetchPage: (input: I) => Promise<R>;
  readonly adapter: PaginationAdapter<I, R>;
  readonly stream: StreamingDump;
  readonly shouldCollectPages: boolean;
  readonly shouldCollectRecords: boolean;
}

async function runFetchLoop<I, R extends PaginatedResponse>(input: FetchLoopInput<I, R>): Promise<FetchLoopState<I, R>> {
  const { initialInput, requestedPages, fetchPage, adapter, stream, shouldCollectPages, shouldCollectRecords } = input;
  const state: FetchLoopState<I, R> = {
    pagesFetched: 0,
    totalRecords: 0,
    hasMorePagesAvailable: false,
    lastResult: undefined,
    lastInput: initialInput,
    collectedPages: [],
    collectedRecords: []
  };

  let current: I = initialInput;
  for (let i = 0; i < requestedPages; i++) {
    const result = await fetchPage(current);
    state.pagesFetched += 1;
    state.totalRecords += adapter.countOf(result);
    state.lastResult = result;
    state.lastInput = current;

    stream.writePage(result);

    if (shouldCollectPages) {
      state.collectedPages.push(result);
    } else if (shouldCollectRecords) {
      for (const record of result.data ?? []) {
        state.collectedRecords.push(record);
      }
    }

    state.hasMorePagesAvailable = adapter.hasMorePagesAvailable(current, result);
    const next = adapter.nextInput(current, result);
    if (!next) {
      break;
    }
    current = next;
  }

  return state;
}

interface PrintPaginatedOutputInput<I, R extends PaginatedResponse> {
  readonly multiplePagesOutput: MultiplePagesOutputMode;
  readonly summaryMeta: Record<string, unknown>;
  readonly state: FetchLoopState<I, R>;
  readonly adapter: PaginationAdapter<I, R>;
  readonly pickFilter: Maybe<string>;
}

function printPaginatedOutput<I, R extends PaginatedResponse>(input: PrintPaginatedOutputInput<I, R>): void {
  const { multiplePagesOutput, summaryMeta, state, adapter, pickFilter } = input;

  if (multiplePagesOutput === 'meta') {
    console.log(JSON.stringify({ ok: true, meta: summaryMeta }));
  } else if (multiplePagesOutput === 'pages') {
    const data = pickFilter ? state.collectedPages.map((page) => ({ ...page, data: pickFields(page.data as unknown[], pickFilter) })) : state.collectedPages;
    console.log(JSON.stringify({ ok: true, data, meta: summaryMeta }));
  } else {
    // merged_page
    const lastMeta = state.lastResult ? adapter.metaOf(state.lastInput, state.lastResult) : {};
    const data = pickFilter ? pickFields(state.collectedRecords, pickFilter) : state.collectedRecords;
    console.log(JSON.stringify({ ok: true, data, meta: { ...lastMeta, ...summaryMeta } }));
  }
}

/**
 * Runs a list command's fetch loop with multi-page streaming support.
 *
 * - When `multiplePages <= 1` returns `{ handled: false, result }`. The caller invokes its own
 *   `outputResult(...)` to preserve the command's existing single-page meta shape exactly.
 * - When `multiplePages > 1` loops up to `multiplePages` times (or until end-of-data), streams each
 *   page to disk via {@link openStreamingDump}, prints a stdout response per `multiplePagesOutput`,
 *   and returns `{ handled: true }`.
 *
 * @param params - The pagination loop inputs.
 * @param params.initialInput - The first-page input passed to `fetchPage`.
 * @param params.fetchPage - Callback that fetches a single page from the underlying API.
 * @param params.adapter - Adapter that hides the API's pagination scheme (next-input, count, meta, has-more).
 * @param params.multiplePages - Maximum number of pages to fetch in this invocation (1 = single-page passthrough).
 * @param params.multiplePagesOutput - Stdout shape when looping (`meta`, `pages`, or `merged_page`).
 * @param params.dumpOutput - Per-page dump format passed to {@link openStreamingDump}.
 * @param params.dumpMerge - Across-pages dump merge mode passed to {@link openStreamingDump}.
 * @returns `{ handled: false, result }` for single-page mode, otherwise `{ handled: true }` after the loop prints its own response.
 */
export async function runPaginatedList<I, R extends PaginatedResponse>(params: RunPaginatedListParams<I, R>): Promise<RunPaginatedListOutcome<R>> {
  const { initialInput, fetchPage, adapter, multiplePagesOutput, dumpOutput, dumpMerge } = params;
  const requestedPages = Math.max(1, Math.floor(params.multiplePages || 1));
  let outcome: RunPaginatedListOutcome<R>;

  if (requestedPages <= 1) {
    const result = await fetchPage(initialInput);
    outcome = { handled: false, result };
  } else {
    const outputOptions = getOutputOptions();

    if (!outputOptions.dumpDir) {
      console.error('[cli] warning: --multiple-pages used without --dump-dir; results not persisted.');
    }

    const stream = openStreamingDump({ dumpOutput, dumpMerge });

    let state: FetchLoopState<I, R>;
    try {
      state = await runFetchLoop({
        initialInput,
        requestedPages,
        fetchPage,
        adapter,
        stream,
        shouldCollectPages: multiplePagesOutput === 'pages',
        shouldCollectRecords: multiplePagesOutput === 'merged_page'
      });
    } finally {
      stream.close();
    }

    const summaryMeta: Record<string, unknown> = {
      pagesFetched: state.pagesFetched,
      totalRecords: state.totalRecords,
      hasMorePagesAvailable: state.hasMorePagesAvailable,
      dumpFile: stream.mainPath ?? null
    };

    if (stream.pickPath) {
      summaryMeta.dumpFilePick = stream.pickPath;
    }

    printPaginatedOutput({ multiplePagesOutput, summaryMeta, state, adapter, pickFilter: outputOptions.pick });

    outcome = { handled: true };
  }

  return outcome;
}
