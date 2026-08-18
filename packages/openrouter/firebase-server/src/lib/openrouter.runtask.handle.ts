import { type Maybe } from '@dereekb/util';
import { type OpenRouterRunTask, OpenRouterRunTaskState } from '@dereekb/openrouter/firebase';

/**
 * How a caller should proceed given a run task's current state.
 *
 * These three outcomes are what an async-work checkpoint needs, and they map 1:1 onto the
 * complete / poll-again / failed branches an OpenAI `responses.retrieve(id)` call produces today — so an
 * existing retry ladder survives the migration unchanged.
 */
export type OpenRouterRunTaskOutcome = 'complete' | 'queued' | 'failure' | 'missing';

/**
 * Classifies a run task into an outcome.
 *
 * `AWAITING_ASYNC_TOOLS` reports as `queued`: from the caller's side it is indistinguishable from
 * waiting, because it is waiting — just on a tool result rather than on a sweep.
 *
 * @param task - The run task, or null when it does not exist.
 * @returns The outcome.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function openRouterRunTaskOutcome(task: Maybe<OpenRouterRunTask>): OpenRouterRunTaskOutcome {
  let result: OpenRouterRunTaskOutcome;

  if (task == null) {
    result = 'missing';
  } else {
    switch (task.s) {
      case OpenRouterRunTaskState.COMPLETE:
        result = 'complete';
        break;
      case OpenRouterRunTaskState.FAILED:
        result = 'failure';
        break;
      case OpenRouterRunTaskState.QUEUED:
      case OpenRouterRunTaskState.RUNNING:
      case OpenRouterRunTaskState.AWAITING_ASYNC_TOOLS:
      default:
        result = 'queued';
        break;
    }
  }

  return result;
}

/**
 * Handlers for each outcome.
 */
export interface OpenRouterRunTaskResultHandlers<T> {
  /**
   * Called with a COMPLETE task.
   */
  readonly onComplete: (task: OpenRouterRunTask) => Promise<T> | T;
  /**
   * Called while the run is still in flight.
   */
  readonly onQueued: (task: OpenRouterRunTask) => Promise<T> | T;
  /**
   * Called when the run failed with its retry budget spent.
   */
  readonly onFailure: (task: OpenRouterRunTask) => Promise<T> | T;
  /**
   * Called when no run task exists for the key.
   *
   * Defaults to {@link OpenRouterRunTaskResultHandlers.onFailure} semantics via `onMissing` being
   * required only when the caller wants to distinguish the two. A missing document is genuinely
   * different from a failed one — it usually means the enqueue never landed — so it is worth handling.
   */
  readonly onMissing: () => Promise<T> | T;
}

/**
 * Creates a reusable dispatcher for a fixed set of handlers.
 *
 * @param handlers - The per-outcome handlers.
 * @returns A function that dispatches a run task.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function handleOpenRouterRunTaskResultFactory<T>(handlers: OpenRouterRunTaskResultHandlers<T>): (task: Maybe<OpenRouterRunTask>) => Promise<T> {
  return async (task: Maybe<OpenRouterRunTask>) => {
    const outcome = openRouterRunTaskOutcome(task);
    let result: T;

    switch (outcome) {
      case 'complete':
        result = await handlers.onComplete(task as OpenRouterRunTask);
        break;
      case 'queued':
        result = await handlers.onQueued(task as OpenRouterRunTask);
        break;
      case 'failure':
        result = await handlers.onFailure(task as OpenRouterRunTask);
        break;
      case 'missing':
      default:
        result = await handlers.onMissing();
        break;
    }

    return result;
  };
}
