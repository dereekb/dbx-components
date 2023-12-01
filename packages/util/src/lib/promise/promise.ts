import { range } from '../array/array.number';
import { Milliseconds } from '../date/date';
import { IndexNumber } from '../value';
import { Maybe } from '../value/maybe.type';
import { waitForMs } from './wait';

export type RunAsyncTaskForValueConfig<T = unknown> = Omit<PerformAsyncTaskConfig<T>, 'throwError'>;

export type RunAsyncTasksForValuesConfig<T = unknown> = Omit<PerformAsyncTasksConfig<T>, 'throwError'>;

/**
 * Runs the task using the input config, and returns the value. Is always configured to throw the error if it fails.
 */
export async function runAsyncTaskForValue<O>(taskFn: () => Promise<O>, config?: RunAsyncTaskForValueConfig<0>): Promise<Maybe<O>> {
  const { value } = await performAsyncTask(taskFn, {
    ...config,
    throwError: true
  });

  return value;
}

/**
 * Returns the task for each input value, and returns the values. Is always configured to throw the error if it fails.
 *
 * @param input
 * @param taskFn
 * @param config
 * @returns
 */
export async function runAsyncTasksForValues<T, K = unknown>(input: T[], taskFn: PromiseAsyncTaskFn<T, K>, config?: RunAsyncTasksForValuesConfig<T>): Promise<K[]> {
  const results = await performAsyncTasks(input, taskFn, {
    ...config,
    throwError: true
  });

  return results.results.map((x) => x[1]);
}

// MARK: Perform
export type PromiseAsyncTaskFn<T, K = unknown> = (value: T, tryNumber?: number) => Promise<K>;

export interface PerformAsyncTaskResult<O> {
  readonly value: Maybe<O>;
  readonly success: boolean;
}

export interface PerformAsyncTasksResult<I, O> {
  readonly succeded: I[];
  readonly failed: I[];
  readonly results: [I, O][];
  readonly errors: [I, unknown][];
}

export interface PerformAsyncTaskConfig<I = unknown> {
  /**
   * Whether or not to throw an error if the task fails. Defaults to false.
   */
  readonly throwError?: boolean;
  /**
   * Whether or not retries are allowed. Defaults to false/0.
   */
  readonly retriesAllowed?: number | false;
  /**
   * The amount of time to wait between retries. Defaults to 100 ms.
   */
  readonly retryWait?: number;
  /**
   * Optional function to use before a retry.
   */
  readonly beforeRetry?: (value: I, tryNumber?: number) => void | Promise<void>;
}

export interface PerformAsyncTasksConfig<I = unknown> extends PerformAsyncTaskConfig<I>, Pick<PerformTasksInParallelFunctionConfig<I>, 'maxParallelTasks' | 'waitBetweenTasks'> {
  /**
   * Whether or not tasks are performed sequentially or if tasks are all done in "parellel".
   */
  readonly sequential?: boolean;
}

/**
 * Performs the input tasks, and will retry tasks if they fail, up to a certain point.
 *
 * This is useful for retrying sections that may experience optimistic concurrency collisions.
 */
export async function performAsyncTasks<I, O = unknown>(input: I[], taskFn: PromiseAsyncTaskFn<I, O>, config: PerformAsyncTasksConfig<I> = { throwError: true }): Promise<PerformAsyncTasksResult<I, O>> {
  const { sequential, maxParallelTasks } = config;

  let taskResults: [I, O, boolean][] = [];

  await performTasksInParallelFunction({
    taskFactory: (value: I, i) =>
      _performAsyncTask(value, taskFn, config).then((x) => {
        taskResults[i] = x;
      }),
    maxParallelTasks: maxParallelTasks || sequential ? 0 : undefined
  })(input);

  const succeded: I[] = [];
  const failed: I[] = [];
  const results: [I, O][] = [];
  const errors: [I, unknown][] = [];

  taskResults.forEach((x) => {
    const success = x[2];

    if (success) {
      succeded.push(x[0]);
      results.push([x[0], x[1]]);
    } else {
      failed.push(x[0]);
      errors.push([x[0], x[1]]);
    }
  });

  return {
    succeded,
    failed,
    results,
    errors
  };
}

export async function performAsyncTask<O>(taskFn: () => Promise<O>, config?: PerformAsyncTaskConfig<0>): Promise<PerformAsyncTaskResult<O>> {
  const [, value, success] = await _performAsyncTask(0, () => taskFn(), config);
  return { value, success };
}

async function _performAsyncTask<I, O>(value: I, taskFn: PromiseAsyncTaskFn<I, O>, config: PerformAsyncTaskConfig<I> = {}): Promise<[I, O, boolean]> {
  const { throwError: inputThrowError, retriesAllowed: inputRetriesAllowed, retryWait = 200, beforeRetry } = config;
  const throwError = inputThrowError ?? true;
  const retriesAllowed = inputRetriesAllowed ? inputRetriesAllowed : 0;

  async function tryTask(value: I, tryNumber: number): Promise<[O, true] | [Error | unknown, false]> {
    try {
      const result: O = await taskFn(value, tryNumber);
      return [result, true];
    } catch (e) {
      return [e, false];
    }
  }

  async function iterateTask(value: I, tryNumber: number): Promise<[I, O, boolean]> {
    const result = await tryTask(value, tryNumber);
    const success = result[1];

    async function doNextTry() {
      const nextTryNumber = tryNumber + 1;

      if (beforeRetry) {
        await beforeRetry(value, nextTryNumber);
      }

      return iterateTask(value, tryNumber + 1);
    }

    if (success) {
      return [value, ...result];
    }

    const retriesRemaining = retriesAllowed - tryNumber;

    if (retriesRemaining > 0) {
      return retryWait ? waitForMs(retryWait).then(() => doNextTry()) : doNextTry();
    } else {
      // Error out.
      if (throwError) {
        throw result[0];
      } else {
        return [value, undefined as unknown as O, false];
      }
    }
  }

  return iterateTask(value, 0);
}

// MARK: Parallel
export interface PerformTasksInParallelFunctionConfig<I> {
  /**
   * Creates a promise from the input.
   */
  readonly taskFactory: (input: I, value: IndexNumber) => Promise<void>;
  /**
   * The maximum number of items to process in parallel. If there is no max, then all items will be processed in parallel.
   */
  readonly maxParallelTasks?: number;
  /**
   * Optional amount of time to wait between each task.
   */
  readonly waitBetweenTasks?: Milliseconds;
}

/**
 * Function that awaits a promise generate from each of the input values.
 *
 * Will throw an error if any error is encountered as soon as it is encountered. No further tasks will be dispatched, but tasks that have already been dispatched will continue to run.
 */
export type PerformTasksInParallelFunction<I> = (input: I[]) => Promise<void>;

/**
 * Convenience function for calling performTasksInParallelFunction() with the given input.
 *
 * @param input
 * @param config
 * @returns
 */
export function performTasksInParallel<I>(input: I[], config: PerformTasksInParallelFunctionConfig<I>): Promise<void> {
  return performTasksInParallelFunction(config)(input);
}

/**
 * Creates a function that performs tasks in parallel.
 *
 * @param config
 */
export function performTasksInParallelFunction<I>(config: PerformTasksInParallelFunctionConfig<I>): PerformTasksInParallelFunction<I> {
  const { taskFactory, maxParallelTasks, waitBetweenTasks } = config;

  if (!maxParallelTasks) {
    return async (input: I[]) => {
      await Promise.all(input.map((value, i) => taskFactory(value, i)));
    };
  } else {
    return (input: I[]) => {
      return new Promise(async (resolve, reject) => {
        const maxPromisesToRunAtOneTime = Math.min(maxParallelTasks, input.length);
        const endIndex = input.length;

        let i = 0;
        let finishedParallels = 0;
        let hasEncounteredFailure = false;

        // start initial promises
        function dispatchNextPromise() {
          const hasNext = i < endIndex;

          if (hasNext && !hasEncounteredFailure) {
            const value = input[i];
            const promise = taskFactory(value, i);
            i += 1;

            promise.then(
              () => {
                setTimeout(dispatchNextPromise, waitBetweenTasks);
              },
              (e) => {
                hasEncounteredFailure = true;
                reject(e);
              }
            );
          } else if (!hasNext) {
            finishedParallels += 1;

            // only resolve after the last parallel is complete
            if (finishedParallels === maxPromisesToRunAtOneTime) {
              resolve();
            }
          }
        }

        // run the initial promises
        range(0, maxPromisesToRunAtOneTime).forEach(() => {
          dispatchNextPromise();
        });
      });
    };
  }
}

// MARK: Compat
/**
 * @deprecated Use functions directly instead.
 */
export class PromiseUtility {
  // MARK: Run
  static async runTaskForValue<O>(taskFn: () => Promise<O>, config?: RunAsyncTaskForValueConfig<0>): Promise<Maybe<O>> {
    return runAsyncTaskForValue(taskFn, { ...config, retriesAllowed: 5 });
  }
  static async runTasksForValues<T, K = unknown>(input: T[], taskFn: PromiseAsyncTaskFn<T, K>, config?: RunAsyncTasksForValuesConfig<T>): Promise<K[]> {
    return runAsyncTasksForValues(input, taskFn, { ...config, retriesAllowed: 5 });
  }

  // MARK: Perform
  static async performTasks<T, K = unknown>(input: T[], taskFn: PromiseAsyncTaskFn<T, K>, config: PerformAsyncTasksConfig<T> = { throwError: true }): Promise<PerformAsyncTasksResult<T, K>> {
    return performAsyncTasks(input, taskFn, { ...config, retriesAllowed: 5 });
  }

  static async performTask<O>(taskFn: () => Promise<O>, config?: PerformAsyncTaskConfig<0>): Promise<PerformAsyncTaskResult<O>> {
    return performAsyncTask(taskFn, { ...config, retriesAllowed: 5 });
  }
}

/**
 * @deprecated use PerformAsyncTaskResult<O>
 */
export type PerformTaskResult<O> = PerformAsyncTaskResult<O>;

/**
 * @deprecated use PerformAsyncTasksResult<T, K>
 */
export type PerformTasksResult<T, K> = PerformAsyncTasksResult<T, K>;

/**
 * @deprecated use PerformAsyncTaskConfig<T>
 */
export type PerformTaskConfig<T = unknown> = PerformAsyncTaskConfig<T>;

/**
 * @deprecated use RunAsyncTaskForValueConfig<T>
 */
export type ValueTaskConfig<T = unknown> = RunAsyncTaskForValueConfig<T>;

/**
 * @deprecated use PerformAsyncTasksConfig<T>
 */
export type PerformTasksConfig<T = unknown> = PerformAsyncTasksConfig<T>;
