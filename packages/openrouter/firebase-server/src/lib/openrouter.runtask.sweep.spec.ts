import { describe, expect, it, vi } from 'vitest';
import { type Maybe } from '@dereekb/util';
import { type OpenRouterRunTaskDocument, OpenRouterRunTaskState } from '@dereekb/openrouter/firebase';
import { type OpenRouterDeleteExpiredRunTasksParams, type OpenRouterDeleteExpiredRunTasksResult, type OpenRouterRunTaskExecutionResult, type OpenRouterRunTaskService } from './openrouter.runtask.service';
import { openRouterRunTaskExpirationSweep, openRouterRunTaskSweep } from './openrouter.runtask.sweep';

/**
 * A fake queue: `pages` is drained one entry per `claimNextRunTasks` call.
 */
function fakeService(config: { pages: string[][]; executeDelayMs?: number; stateFor?: (key: string) => OpenRouterRunTaskState }): OpenRouterRunTaskService & { readonly executed: string[]; readonly claims: number } {
  const pages = [...config.pages];
  const executed: string[] = [];
  let claims = 0;

  const service = {
    claimNextRunTasks: async () => {
      claims += 1;
      const page = pages.shift() ?? [];
      return page.map((key) => ({ id: key }) as unknown as OpenRouterRunTaskDocument);
    },
    executeRunTask: async (document: OpenRouterRunTaskDocument): Promise<OpenRouterRunTaskExecutionResult> => {
      if (config.executeDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, config.executeDelayMs));
      }

      executed.push(document.id);
      return { key: document.id, state: config.stateFor?.(document.id) ?? OpenRouterRunTaskState.COMPLETE };
    },
    enqueueRunTask: vi.fn(),
    readRunTask: vi.fn(),
    runTaskDocument: vi.fn(),
    resolveDeferredTool: vi.fn(),
    deleteExpiredRunTasks: vi.fn(),
    attachFilesForAttempt: vi.fn()
  } as unknown as OpenRouterRunTaskService;

  // `defineProperties`, NOT `Object.assign`: assign INVOKES a source getter and copies its value, which
  // would freeze `claims` at the 0 it held before the sweep ever ran.
  return Object.defineProperties(service, {
    executed: { get: () => executed },
    claims: { get: () => claims }
  }) as OpenRouterRunTaskService & { readonly executed: string[]; readonly claims: number };
}

describe('openRouterRunTaskSweep()', () => {
  it('should drain every page until the queue is empty', async () => {
    const service = fakeService({ pages: [['a', 'b'], ['c'], []] });
    const result = await openRouterRunTaskSweep({ service, maxParallelTasks: 10 });

    expect(service.executed.sort()).toEqual(['a', 'b', 'c']);
    expect(result.executed).toBe(3);
    expect(result.completed).toBe(3);
    expect(result.pages).toBe(2);
    expect(result.stoppedForTimeBudget).toBe(false);
  });

  it('should execute 25 tasks across pages, all reaching a terminal state', async () => {
    const keys = Array.from({ length: 25 }, (_, i) => `t${i}`);
    const service = fakeService({ pages: [keys.slice(0, 10), keys.slice(10, 20), keys.slice(20), []] });
    const result = await openRouterRunTaskSweep({ service, maxParallelTasks: 10, pageSize: 10 });

    expect(result.executed).toBe(25);
    expect(result.completed).toBe(25);
    expect(service.executed.sort()).toEqual(keys.sort());
  });

  it('should stop claiming new pages once the time budget is spent', async () => {
    // THE test that protects every other workload sharing the runner: the sweep must return rather than
    // run long, leaving the remainder QUEUED for the next tick.
    const service = fakeService({ pages: [['a'], ['b'], ['c'], ['d']], executeDelayMs: 40 });
    const result = await openRouterRunTaskSweep({ service, maxParallelTasks: 1, pageSize: 1, maxRunTimeMs: 50 });

    expect(result.stoppedForTimeBudget).toBe(true);
    expect(result.executed).toBeLessThan(4);
    // Un-claimed pages were never touched, so their tasks stay QUEUED.
    expect(service.executed).not.toContain('d');
  });

  it('should finish executing an already-claimed page even when the budget expires mid-page', async () => {
    // A claimed task already holds a lease and already spent an attempt; abandoning it would leave a
    // RUNNING document waiting on lease reclamation for nothing.
    const service = fakeService({ pages: [['a', 'b', 'c'], ['d']], executeDelayMs: 30 });
    const result = await openRouterRunTaskSweep({ service, maxParallelTasks: 1, pageSize: 3, maxRunTimeMs: 40 });

    expect(service.executed).toEqual(['a', 'b', 'c']);
    expect(result.stoppedForTimeBudget).toBe(true);
  });

  it('should not claim anything when the budget is already spent', async () => {
    const service = fakeService({ pages: [['a']] });
    const result = await openRouterRunTaskSweep({ service, maxRunTimeMs: 0 });

    expect(service.claims).toBe(0);
    expect(result.executed).toBe(0);
    expect(result.stoppedForTimeBudget).toBe(true);
  });

  it('should respect maxPages', async () => {
    const service = fakeService({ pages: [['a'], ['b'], ['c']] });
    const result = await openRouterRunTaskSweep({ service, pageSize: 1, maxPages: 2 });

    expect(result.pages).toBe(2);
    expect(service.executed).toEqual(['a', 'b']);
    expect(result.stoppedForTimeBudget).toBe(false);
  });

  it('should count each terminal and paused state separately', async () => {
    const stateFor = (key: string) => (key === 'a' ? OpenRouterRunTaskState.COMPLETE : key === 'b' ? OpenRouterRunTaskState.FAILED : key === 'c' ? OpenRouterRunTaskState.QUEUED : OpenRouterRunTaskState.AWAITING_ASYNC_TOOLS);
    const service = fakeService({ pages: [['a', 'b', 'c', 'd'], []], stateFor });
    const result = await openRouterRunTaskSweep({ service });

    expect(result.completed).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.requeued).toBe(1);
    expect(result.awaitingAsyncTools).toBe(1);
  });

  it('should return immediately for an empty queue', async () => {
    const service = fakeService({ pages: [[]] });
    const result = await openRouterRunTaskSweep({ service });

    expect(result.executed).toBe(0);
    expect(result.pages).toBe(0);
    expect(result.stoppedForTimeBudget).toBe(false);
  });
});

/**
 * A fake retention service: each `deleteExpiredRunTasks` call drains one entry of `pages` and records the
 * `before` cutoff it was handed.
 */
function fakeExpirationService(config: { pages: string[][]; deleteDelayMs?: number }): OpenRouterRunTaskService & { readonly cutoffs: Maybe<Date>[]; readonly calls: number } {
  const pages = [...config.pages];
  const cutoffs: Maybe<Date>[] = [];

  const service = {
    deleteExpiredRunTasks: async (params: OpenRouterDeleteExpiredRunTasksParams): Promise<OpenRouterDeleteExpiredRunTasksResult> => {
      cutoffs.push(params.before);

      if (config.deleteDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, config.deleteDelayMs));
      }

      const keys = pages.shift() ?? [];
      return { deleted: keys.length, keys };
    },
    claimNextRunTasks: vi.fn(),
    executeRunTask: vi.fn(),
    enqueueRunTask: vi.fn(),
    readRunTask: vi.fn(),
    runTaskDocument: vi.fn(),
    resolveDeferredTool: vi.fn(),
    attachFilesForAttempt: vi.fn()
  } as unknown as OpenRouterRunTaskService;

  return Object.defineProperties(service, {
    cutoffs: { get: () => cutoffs },
    calls: { get: () => cutoffs.length }
  }) as OpenRouterRunTaskService & { readonly cutoffs: Maybe<Date>[]; readonly calls: number };
}

describe('openRouterRunTaskExpirationSweep()', () => {
  it('should loop until a page comes back empty and sum what it deleted', async () => {
    // An empty page is the ONLY "done" signal, because the pass deletes what it reads: the page just
    // deleted no longer matches the query, so re-running it IS the next page.
    const service = fakeExpirationService({ pages: [['a', 'b'], ['c'], []] });
    const result = await openRouterRunTaskExpirationSweep({ service });

    expect(result.deleted).toBe(3);
    expect(result.pages).toBe(2);
    expect(result.stoppedForTimeBudget).toBe(false);
  });

  it('should page through more expired tasks than one page holds', async () => {
    const service = fakeExpirationService({ pages: [['a', 'b', 'c'], ['d', 'e', 'f'], ['g'], []] });
    const result = await openRouterRunTaskExpirationSweep({ service, pageSize: 3 });

    expect(result.deleted).toBe(7);
    expect(result.pages).toBe(3);
  });

  it('should hand the IDENTICAL cutoff to every page', async () => {
    // The pinned-cutoff invariant. A cutoff advancing with the clock would let a task that ages mid-sweep
    // join a page not yet reached, making the pass unbounded.
    const service = fakeExpirationService({ pages: [['a'], ['b'], ['c'], []], deleteDelayMs: 5 });
    await openRouterRunTaskExpirationSweep({ service, pageSize: 1 });

    expect(service.calls).toBe(4);
    expect(new Set(service.cutoffs.map((x) => x?.getTime())).size).toBe(1);
    expect(service.cutoffs[0]).toBeInstanceOf(Date);
  });

  it('should use the supplied cutoff verbatim', async () => {
    const before = new Date('2026-01-01T00:00:00.000Z');
    const service = fakeExpirationService({ pages: [['a'], []] });

    await openRouterRunTaskExpirationSweep({ service, before });
    expect(service.cutoffs).toEqual([before, before]);
  });

  it('should respect maxPages', async () => {
    const service = fakeExpirationService({ pages: [['a'], ['b'], ['c'], []] });
    const result = await openRouterRunTaskExpirationSweep({ service, pageSize: 1, maxPages: 2 });

    expect(result.pages).toBe(2);
    expect(result.deleted).toBe(2);
    expect(result.stoppedForTimeBudget).toBe(false);
  });

  it('should delete nothing and make no service call when the budget is already spent', async () => {
    const service = fakeExpirationService({ pages: [['a']] });
    const result = await openRouterRunTaskExpirationSweep({ service, maxRunTimeMs: 0 });

    expect(result.deleted).toBe(0);
    expect(result.pages).toBe(0);
    expect(service.calls).toBe(0);
    expect(result.stoppedForTimeBudget).toBe(true);
  });

  it('should stop deleting new pages once the time budget is spent', async () => {
    const service = fakeExpirationService({ pages: [['a'], ['b'], ['c'], ['d']], deleteDelayMs: 40 });
    const result = await openRouterRunTaskExpirationSweep({ service, pageSize: 1, maxRunTimeMs: 50 });

    expect(result.stoppedForTimeBudget).toBe(true);
    expect(result.deleted).toBeLessThan(4);
  });
});
