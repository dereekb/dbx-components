import { describe, expect, it, vi } from 'vitest';
import { type OpenRouterRunTaskDocument, OpenRouterRunTaskState } from '@dereekb/openrouter/firebase';
import { type OpenRouterRunTaskExecutionResult, type OpenRouterRunTaskService } from './openrouter.runtask.service';
import { openRouterRunTaskSweep } from './openrouter.runtask.sweep';

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
    replayRunTask: vi.fn(),
    signFilesForAttempt: vi.fn()
  } as unknown as OpenRouterRunTaskService;

  return Object.assign(service, {
    get executed() {
      return executed;
    },
    get claims() {
      return claims;
    }
  });
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
