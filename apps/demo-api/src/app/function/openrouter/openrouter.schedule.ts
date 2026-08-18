import { MS_IN_MINUTE } from '@dereekb/util';
import { openRouterRunTaskExpirationSweep, openRouterRunTaskSweep } from '@dereekb/openrouter/firebase-server';
import { type DemoScheduleFunction, runDemoScheduledTasks } from '../function.context';

/**
 * Wall-clock budget for one sweep.
 *
 * Deliberately well under the schedule function's own timeout: the sweep shares this runner with the
 * storage-file and notification schedules, and stopping early leaves the rest of the queue QUEUED for
 * the next tick rather than starving everything behind it.
 */
export const DEMO_OPENROUTER_SWEEP_MAX_RUN_TIME = MS_IN_MINUTE * 2;

/**
 * Drains the OpenRouter run-task queue.
 *
 * This is what actually makes the queued execution model work: `enqueueRunTask` writes one document and
 * returns, and nothing runs until a sweep claims it.
 */
export const openRouterRunTaskSweepSchedule: DemoScheduleFunction = async (request) => {
  console.log('openRouterRunTaskSweepSchedule - running');

  await runDemoScheduledTasks({
    sweepOpenRouterRunTasks: async () => {
      const sweepResult = await openRouterRunTaskSweep({ service: request.nest.openRouterRunTaskService, maxRunTimeMs: DEMO_OPENROUTER_SWEEP_MAX_RUN_TIME });
      return { sweepResult };
    }
  });

  console.log('openRouterRunTaskSweepSchedule - done');
};

/**
 * Wall-clock budget for one retention sweep.
 *
 * Smaller than the drain budget on purpose: deleting is cheap, and this shares the same hourly runner as
 * everything else.
 */
export const DEMO_OPENROUTER_EXPIRATION_SWEEP_MAX_RUN_TIME = MS_IN_MINUTE;

/**
 * Deletes the OpenRouter run tasks past their retention age, in every state.
 *
 * A separate schedule from the drain, and a far slower one. A run task is a short-lived execution record —
 * `NotificationTask` owns retrying and durable persistence — so nothing needs to outlive
 * `OPENROUTER_RUN_TASK_MAX_AGE`, and nothing is gained by checking for a week-old document every minute.
 */
export const openRouterRunTaskExpirationSweepSchedule: DemoScheduleFunction = async (request) => {
  console.log('openRouterRunTaskExpirationSweepSchedule - running');

  await runDemoScheduledTasks({
    deleteExpiredOpenRouterRunTasks: async () => {
      const sweepResult = await openRouterRunTaskExpirationSweep({ service: request.nest.openRouterRunTaskService, maxRunTimeMs: DEMO_OPENROUTER_EXPIRATION_SWEEP_MAX_RUN_TIME });
      return { sweepResult };
    }
  });

  console.log('openRouterRunTaskExpirationSweepSchedule - done');
};
