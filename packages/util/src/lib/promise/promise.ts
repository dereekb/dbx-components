import { Maybe } from "../value/maybe";
import { waitForMs } from "./wait";

export type PromiseOrValue<T> = Promise<T> | T;

export function asPromise<T>(input: PromiseOrValue<T>): Promise<T> {
  return Promise.resolve(input);
}

export type PromiseTaskFn<T, K = any> = (value: T, tryNumber?: number) => Promise<K>;

export interface PerformTaskResult<O> {
  value: Maybe<O>;
  success: boolean;
}

export interface PerformTasksResult<T, K> {
  succeded: T[];
  failed: T[];
  results: [T, K][];
}

export interface PerformTaskConfig<T = any> {
  throwError?: boolean;
  retriesAllowed?: number;
  retryWait?: number;
  /**
   * Optional function to use before a retry.
   */
  beforeRetry?: (value: T, tryNumber?: number) => void | Promise<void>;
}

export type ValueTaskConfig<T = any> = Omit<PerformTaskConfig<T>, 'throwError'>;

export interface PerformTasksConfig<T = any> extends PerformTaskConfig<T> {
  /**
   * Whether or not tasks are performed sequentially or if tasks are all done in "parellel".
   */
  sequential?: boolean;
}

export type ValuesTaskConfig<T = any> = Omit<PerformTasksConfig<T>, 'throwError'>;

export class PromiseUtility {

  // MARK: Run
  /**
   * Runs the task using the input config, and returns the value. Is always configured to throw the error if it fails.
   */
  static async runTaskForValue<O>(taskFn: () => Promise<O>, config?: ValueTaskConfig<0>): Promise<Maybe<O>> {
    const { value } = await this.performTask(taskFn, {
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
  static async runTasksForValues<T, K = any>(input: T[], taskFn: PromiseTaskFn<T, K>, config?: PerformTasksConfig<T>): Promise<K[]> {
    const results = await PromiseUtility.performTasks(input, taskFn, {
      ...config,
      throwError: true
    });

    return results.results.map(x => x[1]);
  }

  // MARK: Perform
  /**
   * Performs the input tasks, and will retry tasks if they fail, up to a certain point.
   * 
   * This is useful for retrying sections that may experience optimistic concurrency collisions.
   */
  static async performTasks<T, K = any>(input: T[], taskFn: PromiseTaskFn<T, K>, config: PerformTasksConfig<T> = { throwError: true }): Promise<PerformTasksResult<T, K>> {
    let taskResults: [T, K, boolean][];

    if (config.sequential) {
      taskResults = [];
      for (let i = 0; i < input.length; i += 1) {
        const value = input[i];
        const taskResult = await PromiseUtility._performTask(value, taskFn, config);
        taskResults.push(taskResult);
      }
    } else {
      taskResults = await Promise.all(input.map((value) => PromiseUtility._performTask(value, taskFn, config)));
    }

    const succeded: T[] = [];
    const failed: T[] = [];
    const results: [T, K][] = [];

    taskResults.forEach((x) => {
      const success = x[2];

      if (success) {
        succeded.push(x[0]);
        results.push([x[0], x[1]]);
      } else {
        failed.push(x[0]);
      }
    });

    return {
      succeded,
      failed,
      results
    };
  }

  static async performTask<O>(taskFn: () => Promise<O>, config?: PerformTaskConfig<0>): Promise<PerformTaskResult<O>> {
    const [_, value, success] = await PromiseUtility._performTask(0, () => taskFn(), config);
    return { value, success };
  }

  static async _performTask<I, O>(value: I, taskFn: PromiseTaskFn<I, O>, { throwError, retriesAllowed = 5, retryWait = 200, beforeRetry }: PerformTaskConfig<I> = { throwError: true }): Promise<[I, O, boolean]> {

    async function tryTask(value: I, tryNumber: number): Promise<[O, true] | [Error | any, false]> {
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

      if (success) {
        return [value, ...result];
      }

      const retriesRemaining = retriesAllowed - tryNumber;

      if (retriesRemaining > 0) {
        async function doNextTry() {
          const nextTryNumber = tryNumber + 1;

          if (beforeRetry) {
            await beforeRetry(value, nextTryNumber);
          }

          return iterateTask(value, tryNumber + 1);
        };

        return (retryWait) ? waitForMs(retryWait).then(() => doNextTry()) : doNextTry();
      } else {
        // Error out.
        if (throwError) {
          throw result[0];
        } else {
          return [value, undefined as any, false];
        }
      }
    }

    return iterateTask(value, 0);
  }

}
