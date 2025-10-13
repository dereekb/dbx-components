import { AsyncFactory } from '../getter/getter';
import { Maybe } from '../value';
import { PerformAsyncTaskConfig, runAsyncTasksForValues, RunAsyncTasksForValuesConfig } from './promise';

/**
 * A function that returns a Promise, typically returning void/no value.
 */
export type AsyncTask<T = void> = AsyncFactory<T>;

/**
 * An AsyncTask that has a name and a run function.
 */
export type NamedAsyncTask<T = void> = {
  readonly name: string;
  readonly run: AsyncTask<T>;
};

export type NamedAsyncTaskRecord<T = void> = Record<string, AsyncTask<T>>;

/**
 * A function that runs an array of named async tasks.
 */
export type RunNamedAsyncTasksFunction<T = void> = (inputTasks: RunNamedAsyncTasksInput<T>, options?: Maybe<RunNamedAsyncTasksFunctionOptions<T>>) => Promise<RunNamedAsyncTasksResult<T>>;

/**
 * Options for a RunNamedAsyncTasksFunction.
 */
export type RunNamedAsyncTasksFunctionOptions<T = void> = Maybe<Omit<RunAsyncTasksForValuesConfig<T>, 'nonConcurrentTaskKeyFactory' | 'retriesAllowed' | 'retryWait' | 'beforeRetry'>>;

/**
 * Config for runNamedAsyncTasksFunction().
 */
export interface RunNamedAsyncTasksFunctionConfig<T = void> {
  readonly onTaskSuccess?: (task: NamedAsyncTask<T>, value: T) => void;
  readonly onTaskFailure?: (task: NamedAsyncTask<T>, error: unknown) => void;
  readonly defaultOptions?: RunNamedAsyncTasksFunctionOptions<T>;
}

/**
 * The input for runNamedAsyncTasks(). Either an array of NamedAsyncTasks or a NamedAsyncTaskRecord.
 */
export type RunNamedAsyncTasksInput<T = void> = NamedAsyncTaskRecord<T> | NamedAsyncTask<T>[];

/**
 * The result of runNamedAsyncTasks().
 */
export interface RunNamedAsyncTasksResult<T = void> {
  /**
   * The tasks that were run successfully.
   */
  readonly successfulTasks: NamedAsyncTask<T>[];
  /**
   * The tasks that failed.
   */
  readonly failedTasks: NamedAsyncTask<T>[];
}

/**
 * Creates a new RunNamedAsyncTasksFunction.
 *
 * @param config Optional configuration.
 * @returns A new RunNamedAsyncTasksFunction.
 */
export function runNamedAsyncTasksFunction<T = void>(config?: RunNamedAsyncTasksFunctionConfig<T>): RunNamedAsyncTasksFunction<T> {
  const { onTaskSuccess, onTaskFailure } = config ?? {};

  return async (inputTasks: RunNamedAsyncTasksInput<T>, options?: Maybe<RunNamedAsyncTasksFunctionOptions<T>>) => {
    let tasks: NamedAsyncTask<T>[];

    if (Array.isArray(inputTasks)) {
      tasks = inputTasks;
    } else {
      tasks = Object.entries(inputTasks).map(([name, run]) => {
        const namedTask: NamedAsyncTask<T> = {
          name,
          run
        };

        return namedTask;
      });
    }

    let successfulTasks: NamedAsyncTask<T>[] = [];
    let failedTasks: NamedAsyncTask<T>[] = [];

    await runAsyncTasksForValues(
      tasks,
      async (task) => {
        try {
          const result = await task.run();
          onTaskSuccess?.(task, result);
          successfulTasks.push(task);
        } catch (error) {
          onTaskFailure?.(task, error);
          failedTasks.push(task);
        }
      },
      {
        sequential: true, // sequential by default
        ...config?.defaultOptions,
        ...options,
        // no retries are allowed
        retriesAllowed: 0,
        retryWait: 0
      }
    );

    const result: RunNamedAsyncTasksResult<T> = {
      successfulTasks,
      failedTasks
    };

    return result;
  };
}

/**
 * Runs the input named tasks and returns the results.
 *
 * @param inputTasks
 * @param options
 * @returns
 */
export async function runNamedAsyncTasks<T = void>(inputTasks: RunNamedAsyncTasksInput<T>, config?: RunNamedAsyncTasksFunctionConfig<T>): Promise<RunNamedAsyncTasksResult<T>> {
  return runNamedAsyncTasksFunction(config)(inputTasks);
}
