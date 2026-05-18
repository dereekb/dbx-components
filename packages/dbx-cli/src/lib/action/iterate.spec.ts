import { describe, expect, it, vi } from 'vitest';
import type { OnCallQueryModelResult, OnCallTypedModelParams } from '@dereekb/firebase';
import type { CliContext } from '../context/cli.context';
import { iterateDbxCliCallModel } from './iterate';

interface TestItem {
  readonly value: number;
}

interface TestParams {
  readonly limit?: number;
  readonly cursorDocumentKey?: string;
  readonly filter?: string;
}

function buildPages(pageCount: number, itemsPerPage: number): OnCallQueryModelResult<TestItem>[] {
  const pages: OnCallQueryModelResult<TestItem>[] = [];

  for (let p = 0; p < pageCount; p += 1) {
    const results: TestItem[] = [];
    const keys: string[] = [];

    for (let i = 0; i < itemsPerPage; i += 1) {
      const globalIndex = p * itemsPerPage + i;
      results.push({ value: globalIndex });
      keys.push(`k/${globalIndex}`);
    }

    const isLast = p === pageCount - 1;
    pages.push({
      results,
      keys,
      count: results.length,
      cursorDocumentKey: isLast ? undefined : keys.at(-1),
      hasMore: !isLast
    });
  }

  return pages;
}

function buildCallModelMock(pages: readonly OnCallQueryModelResult<TestItem>[]) {
  const calls: OnCallTypedModelParams<TestParams>[] = [];
  let i = 0;

  const callModel = vi.fn(async (params: OnCallTypedModelParams<TestParams>) => {
    calls.push(params);
    const page = pages[i] ?? { results: [], keys: [], count: 0, hasMore: false };
    i += 1;
    return page as unknown as Record<string, unknown>;
  });

  return { callModel, calls };
}

function buildStubContext(callModel: ReturnType<typeof buildCallModelMock>['callModel']): CliContext {
  return {
    cliName: 'demo-cli',
    envName: 'dev',
    env: { apiBaseUrl: 'http://localhost', oidcIssuer: 'http://localhost', clientId: 'cid' },
    accessToken: 'access-token',
    callModel: callModel as CliContext['callModel'],
    getModel: vi.fn(async () => ({ result: null })) as CliContext['getModel'],
    getMultipleModels: vi.fn(async () => ({ results: [] })) as CliContext['getMultipleModels']
  };
}

describe('iterateDbxCliCallModel()', () => {
  it('paginates an OnCallQueryModelResult query to exhaustion', async () => {
    const pages = buildPages(3, 5);
    const { callModel, calls } = buildCallModelMock(pages);
    const context = buildStubContext(callModel);

    const result = await iterateDbxCliCallModel<TestParams, TestItem>({
      context,
      modelType: 'thing',
      call: 'query',
      params: {}
    });

    expect(result.totalPages).toBe(3);
    expect(result.totalItems).toBe(15);
    expect(result.hitLimit).toBe(false);
    expect(result.items).toHaveLength(15);
    expect(result.items?.map((x) => x.value)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(result.lastCursorDocumentKey).toBeUndefined();
    expect(callModel).toHaveBeenCalledTimes(3);
    expect(calls[0].data).toEqual({});
    expect(calls[1].data).toEqual({ cursorDocumentKey: 'k/4' });
    expect(calls[2].data).toEqual({ cursorDocumentKey: 'k/9' });
  });

  it('respects totalItemsLimit and stops early', async () => {
    const pages = buildPages(3, 5);
    const { callModel } = buildCallModelMock(pages);
    const context = buildStubContext(callModel);

    const result = await iterateDbxCliCallModel<TestParams, TestItem>({
      context,
      modelType: 'thing',
      call: 'query',
      params: {},
      totalItemsLimit: 7
    });

    expect(result.hitLimit).toBe(true);
    expect(result.totalItems).toBe(10);
    expect(callModel).toHaveBeenCalledTimes(2);
  });

  it('caps per-page limit when totalItemsLimit budget is tighter than limitPerPage', async () => {
    const pages = buildPages(3, 5);
    const { callModel, calls } = buildCallModelMock(pages);
    const context = buildStubContext(callModel);

    await iterateDbxCliCallModel<TestParams, TestItem>({
      context,
      modelType: 'thing',
      call: 'query',
      params: {},
      limitPerPage: 50,
      totalItemsLimit: 3
    });

    expect(calls[0].data).toEqual({ limit: 3 });
    expect(callModel).toHaveBeenCalledTimes(1);
  });

  it('stops after maxPages even when hasMore is true', async () => {
    const pages = buildPages(3, 5);
    const { callModel } = buildCallModelMock(pages);
    const context = buildStubContext(callModel);

    const result = await iterateDbxCliCallModel<TestParams, TestItem>({
      context,
      modelType: 'thing',
      call: 'query',
      params: {},
      maxPages: 1
    });

    expect(callModel).toHaveBeenCalledTimes(1);
    expect(result.totalPages).toBe(1);
    expect(result.hitLimit).toBe(true);
  });

  it('runs iterateItem in parallel and returns per-item results in order', async () => {
    const pages = buildPages(2, 4);
    const { callModel } = buildCallModelMock(pages);
    const context = buildStubContext(callModel);

    const result = await iterateDbxCliCallModel<TestParams, TestItem, OnCallQueryModelResult<TestItem>, { readonly squared: number; readonly key: string; readonly pageIndex: number; readonly itemIndex: number }>({
      context,
      modelType: 'thing',
      call: 'query',
      params: {},
      maxParallelPerPage: 4,
      iterateItem: async ({ item, key, pageIndex, itemIndex }) => ({ squared: item.value * item.value, key, pageIndex, itemIndex })
    });

    expect(result.itemResults).toHaveLength(8);
    expect(result.itemResults?.map((x) => x.squared)).toEqual([0, 1, 4, 9, 16, 25, 36, 49]);
    expect(result.itemResults?.[5].key).toBe('k/5');
    expect(result.itemResults?.[5].pageIndex).toBe(1);
    expect(result.itemResults?.[5].itemIndex).toBe(1);
  });

  it('skips failed items when throwError is false', async () => {
    const pages = buildPages(1, 4);
    const { callModel } = buildCallModelMock(pages);
    const context = buildStubContext(callModel);

    const result = await iterateDbxCliCallModel<TestParams, TestItem, OnCallQueryModelResult<TestItem>, number>({
      context,
      modelType: 'thing',
      call: 'query',
      params: {},
      itemPerformTasksConfig: { throwError: false },
      iterateItem: async ({ item }) => {
        if (item.value === 2) {
          throw new Error('boom');
        }
        return item.value;
      }
    });

    expect(result.totalItems).toBe(4);
    expect(result.itemResults).toEqual([0, 1, 3]);
  });

  it('uses a custom responseAdapter for non-OnCallQueryModelResult responses', async () => {
    interface BulkResponse {
      readonly entries: ReadonlyArray<{ readonly id: string; readonly v: number }>;
    }

    const bulkPage: BulkResponse = {
      entries: [
        { id: 'a', v: 1 },
        { id: 'b', v: 2 },
        { id: 'c', v: 3 }
      ]
    };

    const callModel = vi.fn(async () => bulkPage as unknown as Record<string, unknown>);
    const context = buildStubContext(callModel);

    const result = await iterateDbxCliCallModel<TestParams, { readonly id: string; readonly v: number }, BulkResponse>({
      context,
      modelType: 'bulk',
      call: 'custom',
      params: {},
      responseAdapter: {
        items: (raw) => raw.entries,
        keys: (raw) => raw.entries.map((e) => e.id)
        // omit cursorDocumentKey + hasMore → iterator stops after one page
      }
    });

    expect(result.totalPages).toBe(1);
    expect(result.totalItems).toBe(3);
    expect(result.items).toEqual(bulkPage.entries);
    expect(callModel).toHaveBeenCalledTimes(1);
  });

  it('stops on hasMore: false even when a cursorDocumentKey is present', async () => {
    const callModel = vi.fn(async () => ({
      results: [{ value: 1 }],
      keys: ['k/1'],
      count: 1,
      cursorDocumentKey: 'k/1',
      hasMore: false
    }));
    const context = buildStubContext(callModel);

    const result = await iterateDbxCliCallModel<TestParams, TestItem>({
      context,
      modelType: 'thing',
      call: 'query',
      params: {}
    });

    expect(callModel).toHaveBeenCalledTimes(1);
    expect(result.totalPages).toBe(1);
    expect(result.lastCursorDocumentKey).toBe('k/1');
  });

  it('runs iteratePage after iterateItem and exposes pageItemResults', async () => {
    const pages = buildPages(2, 3);
    const { callModel } = buildCallModelMock(pages);
    const context = buildStubContext(callModel);

    const result = await iterateDbxCliCallModel<TestParams, TestItem, OnCallQueryModelResult<TestItem>, number, { readonly pageIndex: number; readonly sum: number }>({
      context,
      modelType: 'thing',
      call: 'query',
      params: {},
      iterateItem: async ({ item }) => item.value,
      iteratePage: async ({ pageIndex, pageItemResults }) => ({ pageIndex, sum: (pageItemResults ?? []).reduce((acc, x) => acc + x, 0) })
    });

    expect(result.pageResults).toEqual([
      { pageIndex: 0, sum: 0 + 1 + 2 },
      { pageIndex: 1, sum: 3 + 4 + 5 }
    ]);
  });
});
