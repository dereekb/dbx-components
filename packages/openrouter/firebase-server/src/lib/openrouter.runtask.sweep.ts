import { type Maybe, type Milliseconds, MS_IN_MINUTE, performTasksInParallel, randomNumberFactory } from '@dereekb/util';
import { OPENROUTER_RUN_TASK_MAX_AGE, type OpenRouterRunTaskDocument, OpenRouterRunTaskState } from '@dereekb/openrouter/firebase';
import { type OpenRouterRunTaskExecutionResult, type OpenRouterRunTaskService } from './openrouter.runtask.service';

/**
 * Default number of tasks executed concurrently by one sweep.
 */
export const DEFAULT_OPENROUTER_SWEEP_MAX_PARALLEL_TASKS = 10;

/**
 * Default wall-clock budget for one sweep.
 */
export const DEFAULT_OPENROUTER_SWEEP_MAX_RUN_TIME: Milliseconds = MS_IN_MINUTE * 4;

/**
 * Default number of tasks claimed per page.
 */
export const DEFAULT_OPENROUTER_SWEEP_PAGE_SIZE = 20;

/**
 * Default number of expired tasks deleted per retention page.
 *
 * Well under the 500-write batch ceiling: retention runs on its own far slower schedule, so there is
 * nothing to gain from maximising a single page.
 */
export const DEFAULT_OPENROUTER_EXPIRATION_SWEEP_PAGE_SIZE = 200;

/**
 * Default wall-clock budget for one retention sweep.
 */
export const DEFAULT_OPENROUTER_EXPIRATION_SWEEP_MAX_RUN_TIME: Milliseconds = MS_IN_MINUTE * 2;

/**
 * Params for {@link openRouterRunTaskSweep}.
 */
export interface OpenRouterRunTaskSweepParams {
  /**
   * The run task service to drain.
   */
  readonly service: OpenRouterRunTaskService;
  /**
   * How many tasks run concurrently. Defaults to {@link DEFAULT_OPENROUTER_SWEEP_MAX_PARALLEL_TASKS}.
   *
   * Throughput comes from here, not from a longer wall clock — which is what lets the sweep share a
   * runner with other workloads.
   */
  readonly maxParallelTasks?: Maybe<number>;
  /**
   * Hard wall-clock budget. Defaults to {@link DEFAULT_OPENROUTER_SWEEP_MAX_RUN_TIME}.
   *
   * The sweep stops CLAIMING new pages once this is spent and returns; whatever is left stays QUEUED for
   * the next tick. This is a requirement rather than a tuning knob when the sweep shares a scheduled
   * runner with other work: without it, a deep queue starves every workload behind it.
   *
   * It bounds when a new page is claimed, NOT one inference — a single call is atomic and cannot be
   * interrupted, so an unusually slow one can overrun. Bound that with `requestTimeoutMs` in the prompt
   * config and keep this well inside the runner's remaining share.
   */
  readonly maxRunTimeMs?: Maybe<Milliseconds>;
  /**
   * Tasks claimed per page. Defaults to {@link DEFAULT_OPENROUTER_SWEEP_PAGE_SIZE}.
   */
  readonly pageSize?: Maybe<number>;
  /**
   * Identifier recorded as the lease owner. Defaults to a generated one.
   */
  readonly leaseOwner?: Maybe<string>;
  /**
   * Lease duration override.
   */
  readonly leaseDuration?: Maybe<Milliseconds>;
  /**
   * Maximum number of pages to claim in one sweep. Defaults to unlimited (bounded by the time budget).
   */
  readonly maxPages?: Maybe<number>;
}

/**
 * Outcome of one sweep.
 */
export interface OpenRouterRunTaskSweepResult {
  /**
   * Number of tasks claimed and executed.
   */
  readonly executed: number;
  /**
   * How many reached each terminal or paused state.
   */
  readonly completed: number;
  readonly failed: number;
  readonly requeued: number;
  readonly awaitingAsyncTools: number;
  /**
   * Number of pages claimed.
   */
  readonly pages: number;
  /**
   * Whether the sweep stopped because its time budget ran out rather than because the queue was empty.
   *
   * The signal that the queue is deeper than one tick can drain.
   */
  readonly stoppedForTimeBudget: boolean;
  /**
   * Elapsed wall-clock time.
   */
  readonly durationMs: Milliseconds;
  /**
   * The per-task results, in completion order.
   */
  readonly results: OpenRouterRunTaskExecutionResult[];
}

const randomSweepId = randomNumberFactory({ min: 0, max: 1_000_000_000, round: 'floor' });

/**
 * Drains the run-task queue within a strict time budget.
 *
 * Claim a page by lease, run `maxParallelTasks` at a time, write results, repeat — until the queue is
 * empty or the budget is spent. Mount it on a schedule the app already runs; it does not need one of its
 * own, and it must not assume it is the only tenant of the one it gets.
 *
 * @param params - The service and budget settings.
 * @returns What the sweep did.
 */
export async function openRouterRunTaskSweep(params: OpenRouterRunTaskSweepParams): Promise<OpenRouterRunTaskSweepResult> {
  const { service, maxParallelTasks, maxRunTimeMs, pageSize, leaseOwner: inputLeaseOwner, leaseDuration, maxPages } = params;

  const startedAt = Date.now();
  const budget = maxRunTimeMs ?? DEFAULT_OPENROUTER_SWEEP_MAX_RUN_TIME;
  const parallelTasks = maxParallelTasks ?? DEFAULT_OPENROUTER_SWEEP_MAX_PARALLEL_TASKS;
  const limitPerPage = pageSize ?? DEFAULT_OPENROUTER_SWEEP_PAGE_SIZE;
  const leaseOwner = inputLeaseOwner ?? `openRouterRunTaskSweep_${startedAt}_${randomSweepId()}`;

  const results: OpenRouterRunTaskExecutionResult[] = [];
  let pages = 0;
  let stoppedForTimeBudget = false;

  const elapsed = () => Date.now() - startedAt;

  for (;;) {
    if (elapsed() >= budget) {
      stoppedForTimeBudget = true;
      break;
    }

    if (maxPages != null && pages >= maxPages) {
      break;
    }

    const claimed: OpenRouterRunTaskDocument[] = await service.claimNextRunTasks({ limit: limitPerPage, leaseOwner, leaseDuration });

    if (claimed.length === 0) {
      break;
    }

    pages += 1;

    // Every claimed task IS executed, even if the budget expires mid-page: it already holds a lease and
    // its attempt counter is already spent, so abandoning it would leave a RUNNING document waiting on
    // lease reclamation for no reason.
    await performTasksInParallel(claimed, {
      maxParallelTasks: parallelTasks,
      taskFactory: async (document) => {
        const result = await service.executeRunTask(document);
        results.push(result);
      }
    });
  }

  const durationMs = elapsed();

  return {
    executed: results.length,
    completed: results.filter((x) => x.state === OpenRouterRunTaskState.COMPLETE).length,
    failed: results.filter((x) => x.state === OpenRouterRunTaskState.FAILED).length,
    requeued: results.filter((x) => x.state === OpenRouterRunTaskState.QUEUED).length,
    awaitingAsyncTools: results.filter((x) => x.state === OpenRouterRunTaskState.AWAITING_ASYNC_TOOLS).length,
    pages,
    stoppedForTimeBudget,
    durationMs,
    results
  };
}

/**
 * Params for {@link openRouterRunTaskExpirationSweep}.
 */
export interface OpenRouterRunTaskExpirationSweepParams {
  /**
   * The run task service to delete through.
   */
  readonly service: OpenRouterRunTaskService;
  /**
   * Tasks queued at or before this date are deleted. Defaults to `now - OPENROUTER_RUN_TASK_MAX_AGE`.
   */
  readonly before?: Maybe<Date>;
  /**
   * Tasks deleted per page. Defaults to {@link DEFAULT_OPENROUTER_EXPIRATION_SWEEP_PAGE_SIZE}.
   */
  readonly pageSize?: Maybe<number>;
  /**
   * Hard wall-clock budget. Defaults to {@link DEFAULT_OPENROUTER_EXPIRATION_SWEEP_MAX_RUN_TIME}.
   */
  readonly maxRunTimeMs?: Maybe<Milliseconds>;
  /**
   * Maximum number of pages to delete in one sweep. Defaults to unlimited (bounded by the time budget).
   */
  readonly maxPages?: Maybe<number>;
}

/**
 * Outcome of one retention sweep.
 */
export interface OpenRouterRunTaskExpirationSweepResult {
  /**
   * Number of tasks deleted.
   */
  readonly deleted: number;
  /**
   * Number of pages deleted.
   */
  readonly pages: number;
  /**
   * Whether the sweep stopped because its time budget ran out rather than because nothing was left.
   */
  readonly stoppedForTimeBudget: boolean;
  /**
   * Elapsed wall-clock time.
   */
  readonly durationMs: Milliseconds;
}

/**
 * Deletes every run task past its retention age, within a strict time budget.
 *
 * A SEPARATE sweep from {@link openRouterRunTaskSweep}, on a far slower schedule: the drain tick runs every
 * minute and there is nothing a week-old document gains from being looked at that often.
 *
 * @param params - The service and budget settings.
 * @returns What the sweep deleted.
 */
export async function openRouterRunTaskExpirationSweep(params: OpenRouterRunTaskExpirationSweepParams): Promise<OpenRouterRunTaskExpirationSweepResult> {
  const { service, before, pageSize, maxRunTimeMs, maxPages } = params;

  const startedAt = Date.now();
  const budget = maxRunTimeMs ?? DEFAULT_OPENROUTER_EXPIRATION_SWEEP_MAX_RUN_TIME;
  const limitPerPage = pageSize ?? DEFAULT_OPENROUTER_EXPIRATION_SWEEP_PAGE_SIZE;
  // The cutoff is PINNED once for the whole run rather than re-derived per page. A cutoff advancing with the
  // clock would let a task that ages mid-sweep join a page not yet reached, making the pass unbounded.
  const cutoff = before ?? new Date(startedAt - OPENROUTER_RUN_TASK_MAX_AGE);

  let deleted = 0;
  let pages = 0;
  let stoppedForTimeBudget = false;

  const elapsed = () => Date.now() - startedAt;

  for (;;) {
    if (elapsed() >= budget) {
      stoppedForTimeBudget = true;
      break;
    }

    if (maxPages != null && pages >= maxPages) {
      break;
    }

    // No cursor is needed, and one would be meaningless: the page just deleted no longer matches the query,
    // so re-running it IS the next page. That is why an empty page is the only "done" signal — and why a
    // failed delete must throw rather than be swallowed, since a page that keeps matching would loop.
    const page = await service.deleteExpiredRunTasks({ limit: limitPerPage, before: cutoff });

    if (page.deleted === 0) {
      break;
    }

    deleted += page.deleted;
    pages += 1;
  }

  return { deleted, pages, stoppedForTimeBudget, durationMs: elapsed() };
}
