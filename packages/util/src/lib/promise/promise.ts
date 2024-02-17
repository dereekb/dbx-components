import { type ArrayOrValue, asArray, pushArrayItemsIntoArray } from '../array/array';
import { range } from '../array/array.number';
import { type Milliseconds } from '../date/date';
import { type PrimativeKey, type ReadOneOrMoreKeysFunction } from '../key';
import { multiValueMapBuilder } from '../map';
import { incrementingNumberFactory } from '../number';
import { addToSet, setContainsAnyValue } from '../set';
import { type StringFactory, stringFactoryFromFactory } from '../string/factory';
import { type IndexNumber } from '../value';
import { type Maybe } from '../value/maybe.type';
import { waitForMs } from './wait';
import { asPromise, type PromiseOrValue } from './promise.type';
import { terminatingFactoryFromArray } from '../array/array.factory';
import { PromiseReference, promiseReference } from './promise.ref';

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

export interface PerformAsyncTasksConfig<I = unknown, K extends PrimativeKey = PerformTasksInParallelTaskUniqueKey> extends PerformAsyncTaskConfig<I>, Omit<PerformTasksInParallelFunctionConfig<I, K>, 'taskFactory'> {}

/**
 * Performs the input tasks, and will retry tasks if they fail, up to a certain point.
 *
 * This is useful for retrying sections that may experience optimistic concurrency collisions.
 */
export async function performAsyncTasks<I, O = unknown, K extends PrimativeKey = PerformTasksInParallelTaskUniqueKey>(input: I[], taskFn: PromiseAsyncTaskFn<I, O>, config: PerformAsyncTasksConfig<I, K> = { throwError: true }): Promise<PerformAsyncTasksResult<I, O>> {
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

export async function performAsyncTask<O>(taskFn: () => Promise<O>, config?: PerformAsyncTaskConfig<0>): Promise<PerformAsyncTaskResult<O>> {
  const [, value, success] = await _performAsyncTask(0, () => taskFn(), config);
  return { value, success };
}

async function _performAsyncTask<I, O>(value: I, taskFn: PromiseAsyncTaskFn<I, O>, config: PerformAsyncTaskConfig<I> = {}): Promise<[I, O, boolean]> {
  const { throwError: inputThrowError, retriesAllowed: inputRetriesAllowed, retryWait = 200, beforeRetry } = config;
  const throwError = inputThrowError ?? true; // throw errors by default
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
/**
 * Used as a key to identify the "group" that a task belongs to to prevent other concurrent tasks from that group from running in parallel when parallel execution is desired.
 */
export type PerformTasksInParallelTaskUniqueKey = string;

export interface PerformTasksInParallelFunctionConfig<I, K extends PrimativeKey = PerformTasksInParallelTaskUniqueKey> extends Omit<PerformTasksFromFactoryInParallelFunctionConfig<I, K>, 'waitBetweenTaskInputRequests'> {}

/**
 * Function that awaits a promise generated from each of the input values.
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
export function performTasksInParallel<I, K extends PrimativeKey = PerformTasksInParallelTaskUniqueKey>(input: I[], config: PerformTasksInParallelFunctionConfig<I, K>): Promise<void> {
  return performTasksInParallelFunction(config)(input);
}

/**
 * Creates a function that performs tasks in parallel.
 *
 * @param config
 */
export function performTasksInParallelFunction<I, K extends PrimativeKey = PerformTasksInParallelTaskUniqueKey>(config: PerformTasksInParallelFunctionConfig<I, K>): PerformTasksInParallelFunction<I> {
  const { taskFactory, sequential, nonConcurrentTaskKeyFactory, maxParallelTasks: inputMaxParallelTasks, waitBetweenTasks } = config;
  const maxParallelTasks = inputMaxParallelTasks ?? (sequential ? 1 : undefined);

  if (!maxParallelTasks && !nonConcurrentTaskKeyFactory) {
    const defaultNonConcurrentTaskKeyFactory = stringFactoryFromFactory(incrementingNumberFactory(), (x) => x.toString()) as unknown as StringFactory<any>;

    // if the max number of parallel tasks is not defined, then run all tasks at once, unless there is a nonConcurrentTaskKeyFactory
    return async (input: I[]) => {
      await Promise.all(input.map((value, i) => taskFactory(value, i, defaultNonConcurrentTaskKeyFactory())));
    };
  } else {
    const performTasks = performTasksFromFactoryInParallelFunction(config);

    return async (input: I[]) => {
      const taskInputFactory = terminatingFactoryFromArray(
        [input], // all in a single task array to run concurrently
        null
      );
      return performTasks(taskInputFactory);
    };
  }
}

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
  readonly nonConcurrentTaskKeyFactory?: ReadOneOrMoreKeysFunction<I, K>;
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
  // readonly waitForTaskArrayToComplete?: boolean; // TODO: implement
}

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
 * Creates a function that performs tasks from the task factory in parallel.
 *
 * @param config
 */
export function performTasksFromFactoryInParallelFunction<I, K extends PrimativeKey = PerformTasksInParallelTaskUniqueKey>(config: PerformTasksFromFactoryInParallelFunctionConfig<I, K>): PerformTaskFactoryTasksInParallelFunction<I> {
  const defaultNonConcurrentTaskKeyFactory = stringFactoryFromFactory(incrementingNumberFactory(), (x) => x.toString()) as unknown as StringFactory<any>;
  const { taskFactory, sequential, waitBetweenTaskInputRequests, nonConcurrentTaskKeyFactory, maxParallelTasks: inputMaxParallelTasks, waitBetweenTasks } = config;
  const maxParallelTasks = inputMaxParallelTasks ?? (sequential ? 1 : undefined);
  const maxPromisesToRunAtOneTime = Math.max(1, maxParallelTasks ?? 1);

  return (taskInputFactory: PerformTaskFactoryTasksInParallelFunctionTaskInputFactory<I>) => {
    return new Promise(async (resolve, reject) => {
      const taskKeyFactory = nonConcurrentTaskKeyFactory ?? defaultNonConcurrentTaskKeyFactory;

      let incompleteTasks: Readonly<[I, K[], IndexNumber]>[] = [];

      type NextIncompleteTask = typeof incompleteTasks[0] | undefined;

      let baseI = 0;
      let isOutOfTasks = false;
      let isFulfillingTask = false;
      let requestTasksQueue: [IndexNumber, PromiseReference<NextIncompleteTask>][] = [];

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

        if (!isFulfillingTask && requestTasksQueue.length) {
          const nextItemInQueue = requestTasksQueue.pop();

          if (nextItemInQueue) {
            fulfillRequestMoreTasks(nextItemInQueue[0], nextItemInQueue[1]);
          } else {
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

            const waited = await promiseRef.promise;
            return waited;
          } else {
            fulfillRequestMoreTasks(parallelIndex, promiseRef);
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
      const waitingConcurrentTasks = multiValueMapBuilder<typeof incompleteTasks[0], K>();

      async function getNextTask(parallelIndex: IndexNumber): Promise<NextIncompleteTask> {
        let nextTask: NextIncompleteTask = undefined;

        while (!nextTask) {
          // request more tasks if the tasks list is empty
          if (!isOutOfTasks && incompleteTasks.length === 0) {
            nextTask = await requestMoreTasks(parallelIndex);
          }

          nextTask = nextTask ?? incompleteTasks.pop();

          if (nextTask != null) {
            const nextTaskTuple = nextTask;
            const nextTaskTupleIndex = nextTaskTuple[2];

            if (visitedTaskIndexes.has(nextTaskTupleIndex)) {
              // already run. Ignore.
              nextTask = undefined;
            } else {
              const keys = nextTaskTuple[1];
              const keyOfTaskCurrentlyInUse = setContainsAnyValue(currentParellelTaskKeys, keys);

              if (keyOfTaskCurrentlyInUse) {
                keys.forEach((key) => waitingConcurrentTasks.addTuples(key, nextTaskTuple)); // add to each key as waiting
                nextTask = undefined; // clear to continue loop
              } else {
                addToSet(currentParellelTaskKeys, keys); // add to the current task keys, exit loop
                break;
              }
            }
          } else {
            break; // no tasks remaining, break.
          }
        }

        if (nextTask) {
          // mark to prevent running again/concurrent runs
          visitedTaskIndexes.add(nextTask[2]);
        }

        return nextTask;
      }

      function onTaskCompleted(task: typeof incompleteTasks[0], parallelIndex: IndexNumber): void {
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

            promise.then(
              () => {
                onTaskCompleted(nextTask, parallelIndex);
                setTimeout(() => dispatchNextPromise(parallelIndex), waitBetweenTasks);
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
        dispatchNextPromise(parallelIndex);
      });
    });
  };
}
