import { type ArrayOrValue, asArray } from '../array/array';
import { range } from '../array/array.number';
import { type Milliseconds } from '../date/date';
import { type ReadAllKeysFunction, type PrimativeKey } from '../key';
import { multiValueMapBuilder } from '../map';
import { incrementingNumberFactory } from '../number';
import { addToSet, setContainsAnyValue } from '../set';
import { type StringFactory, stringFactoryFromFactory } from '../string/factory';
import { type IndexNumber } from '../value';
import { type Maybe } from '../value/maybe.type';
import { waitForMs } from './wait';
import { asPromise, type PromiseOrValue } from './promise.type';
import { terminatingFactoryFromArray } from '../array/array.factory';
import { type PromiseReference, promiseReference } from './promise.ref';

/**
 * Configuration for {@link runAsyncTaskForValue}, which omits `throwError` since it always throws on failure.
 */
export type RunAsyncTaskForValueConfig<T = unknown> = Omit<PerformAsyncTaskConfig<T>, 'throwError'>;

/**
 * Configuration for {@link runAsyncTasksForValues}, which omits `throwError` since it always throws on failure.
 */
export type RunAsyncTasksForValuesConfig<T = unknown> = Omit<PerformAsyncTasksConfig<T>, 'throwError'>;

/**
 * Runs a single async task and returns the resulting value. Always configured to throw on failure.
 *
 * @param taskFn - The async task to execute.
 * @param config - Optional configuration for retries and retry behavior.
 * @returns The value produced by the task, or undefined if the task produced no value.
 * @throws Rethrows any error thrown by the task function.
 */
export async function runAsyncTaskForValue<O>(taskFn: () => Promise<O>, config?: RunAsyncTaskForValueConfig<0>): Promise<Maybe<O>> {
  const { value } = await performAsyncTask(taskFn, {
    ...config,
    throwError: true
  });

  return value;
}

/**
 * Runs an async task for each input value and returns an array of the resulting values.
 * Always configured to throw on failure.
 *
 * @param input - The array of input values to process.
 * @param taskFn - The async task function to run for each input value.
 * @param config - Optional configuration for parallelism and retries.
 * @returns An array of results produced by the task function for each input.
 * @throws Rethrows any error thrown by a task function.
 */
export async function runAsyncTasksForValues<T, K = unknown>(input: T[], taskFn: PerformAsyncTaskFn<T, K>, config?: RunAsyncTasksForValuesConfig<T>): Promise<K[]> {
  const results = await performAsyncTasks(input, taskFn, {
    ...config,
    throwError: true
  });

  return results.results.map((x) => x[1]);
}

// MARK: Perform
/**
 * An async function that processes a value and returns a result. Receives the current retry/try number.
 *
 * @param value - The input value to process.
 * @param tryNumber - The current attempt number (0-based).
 */
export type PerformAsyncTaskFn<T, K = unknown> = (value: T, tryNumber?: number) => Promise<K>;

/**
 * The result of executing a single async task via {@link performAsyncTask}.
 */
export interface PerformAsyncTaskResult<O> {
  /**
   * The resulting value if the task succeeded, or undefined on failure.
   */
  readonly value: Maybe<O>;
  /**
   * Whether the task completed successfully.
   */
  readonly success: boolean;
}

/**
 * The aggregated result of executing multiple async tasks via {@link performAsyncTasks}.
 */
export interface PerformAsyncTasksResult<I, O> {
  /**
   * Input values whose tasks succeeded.
   */
  readonly succeded: I[];
  /**
   * Input values whose tasks failed.
   */
  readonly failed: I[];
  /**
   * Tuples of [input, output] for each successful task.
   */
  readonly results: [I, O][];
  /**
   * Tuples of [input, error] for each failed task.
   */
  readonly errors: [I, unknown][];
}

/**
 * Configuration for retry behavior when performing async tasks.
 */
export interface PerformAsyncTaskConfig<I = unknown> {
  /**
   * Whether or not to throw an error if the task fails. Defaults to true.
   *
   * If retries are allowed, this will throw the final error from the final try.
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

/**
 * Configuration for {@link performAsyncTasks}, combining retry behavior with parallel execution options.
 */
export interface PerformAsyncTasksConfig<I = unknown, K extends PrimativeKey = PerformTasksInParallelTaskUniqueKey> extends PerformAsyncTaskConfig<I>, Omit<PerformTasksInParallelFunctionConfig<I, K>, 'taskFactory'> {}

/**
 * Performs async tasks for each input value with configurable retry and parallelism behavior.
 * Useful for operations that may experience optimistic concurrency collisions.
 *
 * @param input - The array of input values to process.
 * @param taskFn - The async function to execute for each input.
 * @param config - Configuration for retries, parallelism, and error handling.
 * @returns An aggregated result with succeeded/failed items and their outputs/errors.
 * @throws Rethrows the last error from retries if `throwError` is true (default).
 */
export async function performAsyncTasks<I, O = unknown, K extends PrimativeKey = PerformTasksInParallelTaskUniqueKey>(input: I[], taskFn: PerformAsyncTaskFn<I, O>, config: PerformAsyncTasksConfig<I, K> = { throwError: true }): Promise<PerformAsyncTasksResult<I, O>> {
  const { sequential, maxParallelTasks, waitBetweenTasks, nonConcurrentTaskKeyFactory } = config;
  const taskResults: [I, O, boolean][] = [];

  await performTasksInParallelFunction({
    nonConcurrentTaskKeyFactory,
    taskFactory: (value: I, i) =>
      _performAsyncTask(value, taskFn, config).then((x) => {
        taskResults[i] = x;
      }),
    maxParallelTasks,
    sequential,
    waitBetweenTasks
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

/**
 * Performs a single async task with configurable retry behavior and returns the result with success status.
 *
 * @param taskFn - The async task to execute.
 * @param config - Optional configuration for retries and error handling.
 * @returns A result object containing the value (if successful) and a success flag.
 * @throws Rethrows the last error from retries if `throwError` is true (default).
 */
export async function performAsyncTask<O>(taskFn: () => Promise<O>, config?: PerformAsyncTaskConfig<0>): Promise<PerformAsyncTaskResult<O>> {
  const [, value, success] = await _performAsyncTask(0, () => taskFn(), config);
  return { value, success };
}

async function _performAsyncTask<I, O>(value: I, taskFn: PerformAsyncTaskFn<I, O>, config: PerformAsyncTaskConfig<I> = {}): Promise<[I, O, boolean]> {
  const { throwError: inputThrowError, retriesAllowed: inputRetriesAllowed, retryWait = 200, beforeRetry } = config;
  const throwError = inputThrowError ?? true; // throw errors by default
  const retriesAllowed = inputRetriesAllowed || 0;

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
/**
 * Used as a key to identify the "group" that a task belongs to to prevent other concurrent tasks from that group from running in parallel when parallel execution is desired.
 */
export type PerformTasksInParallelTaskUniqueKey = string;

/**
 * Configuration for {@link performTasksInParallelFunction}, excluding `waitBetweenTaskInputRequests`.
 */
export type PerformTasksInParallelFunctionConfig<I, K extends PrimativeKey = PerformTasksInParallelTaskUniqueKey> = Omit<PerformTasksFromFactoryInParallelFunctionConfig<I, K>, 'waitBetweenTaskInputRequests'>;

/**
 * Function that awaits a promise generated from each of the input values.
 *
 * Will throw an error if any error is encountered as soon as it is encountered. No further tasks will be dispatched, but tasks that have already been dispatched will continue to run.
 */
export type PerformTasksInParallelFunction<I> = (input: I[]) => Promise<void>;

/**
 * Convenience function that creates a parallel task executor and immediately runs it with the given input.
 *
 * @param input - The array of items to process.
 * @param config - Configuration for task execution, parallelism, and concurrency constraints.
 * @returns A Promise that resolves when all tasks complete.
 * @throws Rethrows the first error encountered during task execution.
 */
export function performTasksInParallel<I, K extends PrimativeKey = PerformTasksInParallelTaskUniqueKey>(input: I[], config: PerformTasksInParallelFunctionConfig<I, K>): Promise<void> {
  return performTasksInParallelFunction(config)(input);
}

/**
 * Creates a reusable function that performs tasks in parallel with optional concurrency limits
 * and non-concurrent task key constraints.
 *
 * @param config - Configuration for task factory, parallelism limits, and concurrency keys.
 * @returns A function that accepts an array of inputs and returns a Promise resolving when all tasks complete.
 */
export function performTasksInParallelFunction<I, K extends PrimativeKey = PerformTasksInParallelTaskUniqueKey>(config: PerformTasksInParallelFunctionConfig<I, K>): PerformTasksInParallelFunction<I> {
  const { taskFactory, sequential, nonConcurrentTaskKeyFactory, maxParallelTasks: inputMaxParallelTasks, waitBetweenTasks: _waitBetweenTasks } = config;
  const defaultNonConcurrentTaskKeyFactory = makeDefaultNonConcurrentTaskKeyFactory();
  const maxParallelTasks = inputMaxParallelTasks ?? (sequential ? 1 : undefined);

  function performAllTasksInUnlimitedParallel(input: I[]): Promise<void> {
    return Promise.all(input.map((value, i) => taskFactory(value, i, defaultNonConcurrentTaskKeyFactory()))) as unknown as Promise<void>;
  }

  let result: PerformTasksInParallelFunction<I>;

  if (!maxParallelTasks && !nonConcurrentTaskKeyFactory) {
    // if the max number of parallel tasks is not defined, then run all tasks at once, unless there is a nonConcurrentTaskKeyFactory
    result = performAllTasksInUnlimitedParallel;
  } else {
    const performTasks = performTasksFromFactoryInParallelFunction(config);

    /**
     * Performs the input tasks in parallel using the configured performTasks function.
     *
     * @param input The input tasks to perform
     * @returns A promise that resolves when all tasks have completed
     */
    function performTasksWithInput(input: I[]) {
      const taskInputFactory = terminatingFactoryFromArray(
        [input], // all in a single task array to run concurrently
        null
      );

      return performTasks(taskInputFactory);
    }

    if (maxParallelTasks && !nonConcurrentTaskKeyFactory) {
      result = (input: I[]) => {
        // if there is no custom nonConcurrentTaskKeyFactory, then we can just run all tasks at once and skip the overhead of performTasksInParallel if the input has less than the maxParallelTasks
        if (input.length <= maxParallelTasks) {
          return performAllTasksInUnlimitedParallel(input);
        } else {
          return performTasksWithInput(input);
        }
      };
    } else {
      result = performTasksWithInput;
    }
  }

  return result;
}

/**
 * Configuration for {@link performTasksFromFactoryInParallelFunction}, controlling task execution,
 * parallelism limits, and non-concurrent key constraints.
 */
export interface PerformTasksFromFactoryInParallelFunctionConfig<I, K extends PrimativeKey = PerformTasksInParallelTaskUniqueKey> {
  /**
   * Creates a promise from the input.
   */
  readonly taskFactory: (input: I, value: IndexNumber, taskKeys: K[]) => Promise<void>;
  /**
   * This function is used to uniquely identify tasks that may use the same resources to prevent such tasks from running concurrently.
   *
   * When in use the order is not guranteed.
   */
  readonly nonConcurrentTaskKeyFactory?: Maybe<ReadAllKeysFunction<I, K>>;
  /**
   * Whether or not tasks are performed sequentially or if tasks are all done in "parellel".
   *
   * Is ignored if maxParallelTasks is set.
   */
  readonly sequential?: boolean;
  /**
   * The maximum number of items to process in parallel. If there is no max, then all items will be processed in parallel.
   */
  readonly maxParallelTasks?: number;
  /**
   * Optional amount of time to wait between each task.
   */
  readonly waitBetweenTasks?: Milliseconds;
  /**
   * Optional amount of time to wait between each task input request.
   */
  readonly waitBetweenTaskInputRequests?: Milliseconds;
  /**
   * Whether or not to wait for all tasks to complete before returning.
   */
  // readonly waitForTaskArrayToComplete?: boolean; // TODO(FUTURE): implement
}

/**
 * A factory function that produces the next batch of task inputs. Returns `null` to signal
 * that no more inputs are available.
 */
export type PerformTaskFactoryTasksInParallelFunctionTaskInputFactory<I> = () => PromiseOrValue<ArrayOrValue<I> | null>;

/**
 * Function that awaits all promises generated from the task factory until the factory returns null.
 *
 * If an array is pushed then the task factory will begin (but not necessarily complete) all those tasks before pulling the next set of tasks.
 *
 * Will throw an error if any error is encountered as soon as it is encountered. No further tasks will be dispatched, but tasks that have already been dispatched will continue to run.
 */
export type PerformTaskFactoryTasksInParallelFunction<I> = (taskInputFactory: PerformTaskFactoryTasksInParallelFunctionTaskInputFactory<I>) => Promise<void>;

/**
 * Creates a function that pulls task inputs from a factory and executes them in parallel
 * with configurable concurrency limits and non-concurrent key constraints.
 *
 * @param config - Configuration for the task factory, parallelism, and concurrency behavior.
 * @returns a function that accepts a task input factory and returns a Promise that resolves when all tasks complete
 */
export function performTasksFromFactoryInParallelFunction<I, K extends PrimativeKey = PerformTasksInParallelTaskUniqueKey>(config: PerformTasksFromFactoryInParallelFunctionConfig<I, K>): PerformTaskFactoryTasksInParallelFunction<I> {
  /**
   * @returns null
   */
  const defaultNonConcurrentTaskKeyFactory = () => null;

  const { taskFactory, sequential, waitBetweenTaskInputRequests, nonConcurrentTaskKeyFactory, maxParallelTasks: inputMaxParallelTasks, waitBetweenTasks } = config;
  const maxParallelTasks = inputMaxParallelTasks ?? (sequential ? 1 : undefined);
  const maxPromisesToRunAtOneTime = Math.max(1, maxParallelTasks ?? 1);

  return (taskInputFactory: PerformTaskFactoryTasksInParallelFunctionTaskInputFactory<I>) => {
    return new Promise<void>((resolve, reject) => {
      const taskKeyFactory = nonConcurrentTaskKeyFactory ?? defaultNonConcurrentTaskKeyFactory;

      let incompleteTasks: Readonly<[I, K[], IndexNumber]>[] = [];

      type NextIncompleteTask = (typeof incompleteTasks)[0] | undefined;

      let baseI = 0;
      let isOutOfTasks = false;
      let isFulfillingTask = false;
      const requestTasksQueue: [IndexNumber, PromiseReference<NextIncompleteTask>][] = [];

      async function fulfillRequestMoreTasks(parallelIndex: IndexNumber, promiseReference: PromiseReference<NextIncompleteTask>) {
        if (incompleteTasks.length === 0) {
          isFulfillingTask = true;

          const newTasks = await asPromise(taskInputFactory());

          if (newTasks === null) {
            isOutOfTasks = true;
          } else {
            const newTaskEntries = asArray(newTasks)
              .map((x, i) => [x, asArray(taskKeyFactory(x)), baseI + i] as const)
              .reverse(); // reverse to use push/pop

            baseI += newTaskEntries.length;
            incompleteTasks = [...newTaskEntries, ...incompleteTasks]; // new tasks go to the front of the stack
          }
        }

        const nextTask = incompleteTasks.pop();
        promiseReference.resolve(nextTask); // resolve that promise

        isFulfillingTask = false;

        // wait before popping off the next task in the queue, if applicable
        if (waitBetweenTaskInputRequests) {
          await waitForMs(waitBetweenTaskInputRequests);
        }

        if (requestTasksQueue.length) {
          const nextItemInQueue = requestTasksQueue.pop();

          if (nextItemInQueue) {
            void fulfillRequestMoreTasks(nextItemInQueue[0], nextItemInQueue[1]);
          }
        }
      }

      async function requestMoreTasks(parallelIndex: IndexNumber): Promise<NextIncompleteTask> {
        if (isOutOfTasks) {
          return;
        } else {
          const promiseRef = promiseReference<NextIncompleteTask>();

          if (isFulfillingTask) {
            requestTasksQueue.push([parallelIndex, promiseRef]);

            return promiseRef.promise;
          } else {
            void fulfillRequestMoreTasks(parallelIndex, promiseRef);
          }

          return promiseRef.promise;
        }
      }

      let currentRunIndex = 0;
      let finishedParallels = 0;
      let hasEncounteredFailure = false;

      /**
       * Set of tasks keys that are currently running.
       */
      const currentParellelTaskKeys = new Set<K>();
      const visitedTaskIndexes = new Set<IndexNumber>();
      const waitingConcurrentTasks = multiValueMapBuilder<(typeof incompleteTasks)[0], K>();

      function tryAcquireTask(candidate: NonNullable<NextIncompleteTask>): 'skip' | 'defer' | 'acquired' {
        const candidateIndex = candidate[2];

        if (visitedTaskIndexes.has(candidateIndex)) {
          return 'skip';
        }

        const keys = candidate[1];
        const keyOfTaskCurrentlyInUse = setContainsAnyValue(currentParellelTaskKeys, keys);

        if (keyOfTaskCurrentlyInUse) {
          keys.forEach((key) => waitingConcurrentTasks.addTuples(key, candidate));
          return 'defer';
        }

        addToSet(currentParellelTaskKeys, keys);
        return 'acquired';
      }

      async function getNextTask(parallelIndex: IndexNumber): Promise<NextIncompleteTask> {
        let nextTask: NextIncompleteTask = undefined;

        while (!nextTask) {
          // request more tasks if the tasks list is empty
          if (!isOutOfTasks && incompleteTasks.length === 0) {
            nextTask = await requestMoreTasks(parallelIndex);
          }

          nextTask = nextTask ?? incompleteTasks.pop();

          if (nextTask == null) {
            break;
          }

          const result = tryAcquireTask(nextTask);

          if (result === 'acquired') {
            break;
          }

          nextTask = undefined;
        }

        if (nextTask) {
          // mark to prevent running again/concurrent runs
          visitedTaskIndexes.add(nextTask[2]);
        }

        return nextTask;
      }

      function onTaskCompleted(task: (typeof incompleteTasks)[0], _parallelIndex: IndexNumber): void {
        const keys = task[1];
        const indexesPushed = new Set<IndexNumber>();

        keys.forEach((key) => {
          // un-reserve the key from each parallel task
          currentParellelTaskKeys.delete(key);
          const waitingForKey = waitingConcurrentTasks.get(key);

          while (true) {
            const nextWaitingTask = waitingForKey.shift(); // take from the front to retain unique task order

            if (nextWaitingTask) {
              const nextWaitingTaskIndex = nextWaitingTask[2];

              if (visitedTaskIndexes.has(nextWaitingTaskIndex) || indexesPushed.has(nextWaitingTaskIndex)) {
                // if the task has already been visited, then don't push back onto incomplete tasks.
                continue;
              } else {
                // push to front for the next dispatch to take for this key
                incompleteTasks.push(nextWaitingTask);
                // mark to prevent pushing this one again since it will not get run
                indexesPushed.add(nextWaitingTaskIndex);
                break;
              }
            } else {
              break;
            }
          }
        });
      }

      // start initial promises
      async function dispatchNextPromise(parallelIndex: IndexNumber) {
        // if a failure has been encountered then the promise has already been rejected.
        if (!hasEncounteredFailure) {
          const nextTask = await getNextTask(parallelIndex);

          if (nextTask) {
            // build/start promise
            const promise = taskFactory(nextTask[0], currentRunIndex, nextTask[1]);
            currentRunIndex += 1;

            void promise.then(
              () => {
                onTaskCompleted(nextTask, parallelIndex);
                setTimeout(() => void dispatchNextPromise(parallelIndex), waitBetweenTasks);
              },
              (e) => {
                hasEncounteredFailure = true;
                reject(e);
              }
            );
          } else {
            finishedParallels += 1;

            // only resolve after the last parallel is complete
            if (finishedParallels === maxPromisesToRunAtOneTime) {
              resolve();
            }
          }
        }
      }

      // run the initial promises
      range(0, maxPromisesToRunAtOneTime).forEach((parallelIndex) => {
        void dispatchNextPromise(parallelIndex);
      });
    });
  };
}

/**
 * Creates a default non-concurrent task key factory that generates unique incrementing number strings.
 *
 * @returns A {@link StringFactory} that produces unique keys for identifying non-concurrent tasks.
 */
export function makeDefaultNonConcurrentTaskKeyFactory(): StringFactory<any> {
  return stringFactoryFromFactory(incrementingNumberFactory(), (x) => x.toString()) as unknown as StringFactory<any>;
}
