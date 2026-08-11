import { type Maybe, type Milliseconds, MS_IN_MINUTE, performTasksInParallel, randomNumberFactory } from '@dereekb/util';
import { type OpenRouterRunTaskDocument, OpenRouterRunTaskState } from '@dereekb/openrouter/firebase';
import { type OpenRouterRunTaskExecutionResult, type OpenRouterRunTaskService } from './openrouter.runtask.service';

/**
 * Default number of tasks executed concurrently by one sweep.
 */
export const OPENROUTER_SWEEP_DEFAULT_MAX_PARALLEL_TASKS = 10;

/**
 * Default wall-clock budget for one sweep.
 */
export const OPENROUTER_SWEEP_DEFAULT_MAX_RUN_TIME: Milliseconds = MS_IN_MINUTE * 4;

/**
 * Default number of tasks claimed per page.
 */
export const OPENROUTER_SWEEP_DEFAULT_PAGE_SIZE = 20;

/**
 * Params for {@link openRouterRunTaskSweep}.
 */
export interface OpenRouterRunTaskSweepParams {
  /**
   * The run task service to drain.
   */
  readonly service: OpenRouterRunTaskService;
  /**
   * How many tasks run concurrently. Defaults to {@link OPENROUTER_SWEEP_DEFAULT_MAX_PARALLEL_TASKS}.
   *
   * Throughput comes from here, not from a longer wall clock — which is what lets the sweep share a
   * runner with other workloads.
   */
  readonly maxParallelTasks?: Maybe<number>;
  /**
   * Hard wall-clock budget. Defaults to {@link OPENROUTER_SWEEP_DEFAULT_MAX_RUN_TIME}.
   *
   * The sweep stops CLAIMING new pages once this is spent and returns; whatever is left stays QUEUED for
   * the next tick. This is a requirement rather than a tuning knob when the sweep shares a scheduled
   * runner with other work: without it, a deep queue starves every workload behind it.
   */
  readonly maxRunTimeMs?: Maybe<Milliseconds>;
  /**
   * Tasks claimed per page. Defaults to {@link OPENROUTER_SWEEP_DEFAULT_PAGE_SIZE}.
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
   * Whether tasks are drained in priority order. Defaults to false — see
   * `OpenRouterClaimRunTasksParams.usePriorityOrder` for why that is not the obvious default.
   */
  readonly usePriorityOrder?: Maybe<boolean>;
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
 * The residual risk to accept knowingly: a SINGLE inference is atomic and cannot be interrupted, so one
 * unusually slow call can overrun the budget. Bound it with `requestTimeoutMs` in the prompt config and
 * keep `maxRunTimeMs` well inside the runner's remaining share.
 *
 * @param params - The service and budget settings.
 * @returns What the sweep did.
 */
export async function openRouterRunTaskSweep(params: OpenRouterRunTaskSweepParams): Promise<OpenRouterRunTaskSweepResult> {
  const { service, maxParallelTasks, maxRunTimeMs, pageSize, leaseOwner: inputLeaseOwner, leaseDuration, usePriorityOrder, maxPages } = params;

  const startedAt = Date.now();
  const budget = maxRunTimeMs ?? OPENROUTER_SWEEP_DEFAULT_MAX_RUN_TIME;
  const parallelTasks = maxParallelTasks ?? OPENROUTER_SWEEP_DEFAULT_MAX_PARALLEL_TASKS;
  const limitPerPage = pageSize ?? OPENROUTER_SWEEP_DEFAULT_PAGE_SIZE;
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

    const claimed: OpenRouterRunTaskDocument[] = await service.claimNextRunTasks({ limit: limitPerPage, leaseOwner, leaseDuration, usePriorityOrder });

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
