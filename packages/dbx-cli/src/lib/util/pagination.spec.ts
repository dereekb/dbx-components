import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureOutputOptions } from './output';
import { runPaginatedList, type PaginatedResponse, type PaginationAdapter } from './pagination';

interface TestInput {
  readonly cursor: number;
}

interface TestResponse extends PaginatedResponse {
  readonly data: readonly { readonly id: number; readonly extra: string }[];
  readonly cursor: number;
}

const testAdapter: PaginationAdapter<TestInput, TestResponse> = {
  nextInput: (input, last) => {
    if (last.data.length === 0) {
      return undefined;
    }

    return { cursor: input.cursor + last.data.length };
  },
  countOf: (r) => r.data.length,
  metaOf: (input, _r) => ({ cursor: input.cursor }),
  hasMorePagesAvailable: (_input, r) => r.data.length > 0
};

function makeFetchPage(pages: readonly TestResponse[]): {
  readonly fetchPage: (input: TestInput) => Promise<TestResponse>;
  readonly calls: { readonly inputs: TestInput[] };
} {
  const calls: { readonly inputs: TestInput[] } = { inputs: [] };
  let i = 0;
  const fetchPage = async (input: TestInput): Promise<TestResponse> => {
    calls.inputs.push(input);
    const page = pages[i] ?? { data: [], cursor: input.cursor };
    i += 1;
    return page;
  };
  return { fetchPage, calls };
}

describe('runPaginatedList', () => {
  let tmp: string;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'dbx-cli-pagination-'));
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    configureOutputOptions({});
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
    logSpy.mockRestore();
    errorSpy.mockRestore();
    configureOutputOptions({});
  });

  it('returns handled: false on single-page (multiplePages = 1)', async () => {
    const pages: TestResponse[] = [{ data: [{ id: 1, extra: 'a' }], cursor: 0 }];
    const { fetchPage, calls } = makeFetchPage(pages);

    const outcome = await runPaginatedList({
      initialInput: { cursor: 0 },
      fetchPage,
      adapter: testAdapter,
      multiplePages: 1,
      multiplePagesOutput: 'meta',
      dumpOutput: 'raw',
      dumpMerge: 'replace'
    });

    expect(outcome.handled).toBe(false);

    if (outcome.handled === false) {
      expect(outcome.result).toEqual(pages[0]);
    }

    expect(calls.inputs).toEqual([{ cursor: 0 }]);
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('multi-page meta mode prints summary only', async () => {
    const pages: TestResponse[] = [
      {
        data: [
          { id: 1, extra: 'a' },
          { id: 2, extra: 'b' }
        ],
        cursor: 0
      },
      { data: [{ id: 3, extra: 'c' }], cursor: 2 }
    ];
    const { fetchPage, calls } = makeFetchPage(pages);

    configureOutputOptions({ dumpDir: tmp, commandPath: ['list'] });

    const outcome = await runPaginatedList({
      initialInput: { cursor: 0 },
      fetchPage,
      adapter: testAdapter,
      multiplePages: 5,
      multiplePagesOutput: 'meta',
      dumpOutput: 'raw',
      dumpMerge: 'replace'
    });

    expect(outcome.handled).toBe(true);
    expect(calls.inputs).toEqual([{ cursor: 0 }, { cursor: 2 }, { cursor: 3 }]);

    const printed = JSON.parse(logSpy.mock.calls[0]?.[0] as string) as { ok: boolean; meta: Record<string, unknown> };
    expect(printed.ok).toBe(true);
    expect(printed.meta.pagesFetched).toBe(3);
    expect(printed.meta.totalRecords).toBe(3);
    expect(printed.meta.hasMorePagesAvailable).toBe(false);
    expect(typeof printed.meta.dumpFile).toBe('string');
  });

  it('multi-page pages mode applies --pick filter to record data', async () => {
    const pages: TestResponse[] = [
      { data: [{ id: 1, extra: 'a' }], cursor: 0 },
      { data: [{ id: 2, extra: 'b' }], cursor: 1 }
    ];
    const { fetchPage } = makeFetchPage(pages);

    configureOutputOptions({ dumpDir: tmp, commandPath: ['list'], pick: 'id' });

    await runPaginatedList({
      initialInput: { cursor: 0 },
      fetchPage,
      adapter: testAdapter,
      multiplePages: 2,
      multiplePagesOutput: 'pages',
      dumpOutput: 'raw',
      dumpMerge: 'replace'
    });

    const printed = JSON.parse(logSpy.mock.calls[0]?.[0] as string) as { ok: boolean; data: { data: unknown[] }[] };
    expect(printed.data).toHaveLength(2);
    expect(printed.data[0].data).toEqual([{ id: 1 }]);
    expect(printed.data[1].data).toEqual([{ id: 2 }]);
  });

  it('multi-page merged_page mode flattens records with last-page meta', async () => {
    const pages: TestResponse[] = [
      {
        data: [
          { id: 1, extra: 'a' },
          { id: 2, extra: 'b' }
        ],
        cursor: 0
      },
      { data: [{ id: 3, extra: 'c' }], cursor: 2 }
    ];
    const { fetchPage } = makeFetchPage(pages);

    configureOutputOptions({ dumpDir: tmp, commandPath: ['list'] });

    await runPaginatedList({
      initialInput: { cursor: 0 },
      fetchPage,
      adapter: testAdapter,
      multiplePages: 2,
      multiplePagesOutput: 'merged_page',
      dumpOutput: 'raw',
      dumpMerge: 'replace'
    });

    const printed = JSON.parse(logSpy.mock.calls[0]?.[0] as string) as { data: { id: number }[]; meta: Record<string, unknown> };
    expect(printed.data.map((r) => r.id)).toEqual([1, 2, 3]);
    // metaOf for the last fetched page used input.cursor === 2
    expect(printed.meta.cursor).toBe(2);
    expect(printed.meta.pagesFetched).toBe(2);
  });

  it('short-circuits when adapter signals end of data before requested pages', async () => {
    const pages: TestResponse[] = [
      { data: [{ id: 1, extra: 'a' }], cursor: 0 },
      { data: [], cursor: 1 }
    ];
    const { fetchPage, calls } = makeFetchPage(pages);

    configureOutputOptions({ dumpDir: tmp, commandPath: ['list'] });

    await runPaginatedList({
      initialInput: { cursor: 0 },
      fetchPage,
      adapter: testAdapter,
      multiplePages: 10,
      multiplePagesOutput: 'meta',
      dumpOutput: 'raw',
      dumpMerge: 'replace'
    });

    expect(calls.inputs).toHaveLength(2);
  });

  it('writes warning to stderr when --multiple-pages > 1 without dumpDir', async () => {
    const pages: TestResponse[] = [
      { data: [{ id: 1, extra: 'a' }], cursor: 0 },
      { data: [], cursor: 1 }
    ];
    const { fetchPage } = makeFetchPage(pages);

    await runPaginatedList({
      initialInput: { cursor: 0 },
      fetchPage,
      adapter: testAdapter,
      multiplePages: 5,
      multiplePagesOutput: 'meta',
      dumpOutput: 'raw',
      dumpMerge: 'replace'
    });

    expect(errorSpy).toHaveBeenCalled();
    expect((errorSpy.mock.calls[0]?.[0] as string).toLowerCase()).toContain('--multiple-pages');
  });

  it('dump-merge=replace truncates the dump file each iteration (last page survives)', async () => {
    const pages: TestResponse[] = [
      { data: [{ id: 1, extra: 'a' }], cursor: 0 },
      { data: [{ id: 2, extra: 'b' }], cursor: 1 }
    ];
    const { fetchPage } = makeFetchPage(pages);

    configureOutputOptions({ dumpDir: tmp, commandPath: ['list'] });

    await runPaginatedList({
      initialInput: { cursor: 0 },
      fetchPage,
      adapter: testAdapter,
      multiplePages: 2,
      multiplePagesOutput: 'meta',
      dumpOutput: 'raw',
      dumpMerge: 'replace'
    });

    const printed = JSON.parse(logSpy.mock.calls[0]?.[0] as string) as { meta: { dumpFile: string } };
    const fileText = readFileSync(printed.meta.dumpFile, 'utf-8');
    const parsed = JSON.parse(fileText) as TestResponse;
    expect(parsed.data.map((r) => r.id)).toEqual([2]);
  });

  it('dump-merge=concat with dump-output=data_by_line writes one record per line across pages', async () => {
    const pages: TestResponse[] = [
      {
        data: [
          { id: 1, extra: 'a' },
          { id: 2, extra: 'b' }
        ],
        cursor: 0
      },
      { data: [{ id: 3, extra: 'c' }], cursor: 2 },
      { data: [], cursor: 3 }
    ];
    const { fetchPage } = makeFetchPage(pages);

    configureOutputOptions({ dumpDir: tmp, commandPath: ['list'] });

    await runPaginatedList({
      initialInput: { cursor: 0 },
      fetchPage,
      adapter: testAdapter,
      multiplePages: 5,
      multiplePagesOutput: 'meta',
      dumpOutput: 'data_by_line',
      dumpMerge: 'concat'
    });

    const printed = JSON.parse(logSpy.mock.calls[0]?.[0] as string) as { meta: { dumpFile: string } };
    const lines = readFileSync(printed.meta.dumpFile, 'utf-8').trimEnd().split('\n');
    expect(lines).toHaveLength(3);
    expect(lines.map((l) => (JSON.parse(l) as { id: number }).id)).toEqual([1, 2, 3]);
  });
});
