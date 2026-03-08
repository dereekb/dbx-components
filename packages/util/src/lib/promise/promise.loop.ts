import { batchCalc, type BatchCount, itemCountForBatchIndex } from '../grouping';
import { type Maybe } from '../value/maybe.type';
import { type PromiseOrValue } from './promise.type';

/**
 * Configuration for {@link performTaskLoop} without an initial value.
 */
export interface PerformTaskLoopConfig<O> {
  /** Produces the next value given the iteration index and the previous value. */
  next: (i: number, prev: Maybe<O>) => Promise<O>;
  /** Returns whether to continue looping. Called after each iteration with the current value and next index. */
  checkContinue: (prev: Maybe<O>, i: number) => PromiseOrValue<boolean>;
}

/**
 * Configuration for {@link performTaskLoop} with a required initial value.
 */
export interface PerformTaskLoopWithInitConfig<O> {
  /** The initial value to start the loop with. */
  initValue: O;
  /** Produces the next value given the iteration index and the previous value. */
  next: (i: number, prev: O) => Promise<O>;
  /** Returns whether to continue looping. Called after each iteration with the current value and next index. */
  checkContinue: (prev: O, i: number) => PromiseOrValue<boolean>;
}

// MARK: Loop
/**
 * Executes an async task in a loop, calling `next` repeatedly until `checkContinue` returns false.
 * Optionally starts with an initial value. Returns the final value produced by the loop.
 *
 * @param config - Loop configuration with the next-value producer and continuation check.
 * @returns The final value produced by the last iteration.
 */
export function performTaskLoop<O>(config: PerformTaskLoopWithInitConfig<O>): Promise<O>;
export function performTaskLoop<O>(config: PerformTaskLoopConfig<O>): Promise<O>;
export function performTaskLoop<O>(config: PerformTaskLoopConfig<O>): Promise<Maybe<O>>;
export function performTaskLoop(config: PerformTaskLoopConfig<void>): Promise<void>;
export async function performTaskLoop<O>(config: PerformTaskLoopWithInitConfig<O> | PerformTaskLoopConfig<O>): Promise<O> {
  let result: O;
  const initValue = (config as PerformTaskLoopWithInitConfig<O>).initValue;
  const startLoop = initValue == null || (await config.checkContinue(initValue, -1));

  if (startLoop) {
    let i = 0;
    let prevValue: Maybe<O> = initValue;
    let check: boolean;

    do {
      prevValue = await config.next(i, prevValue);
      i += 1;
      check = await config.checkContinue(prevValue, i);
    } while (check);

    result = prevValue;
  } else {
    result = initValue;
  }

  return result;
}

// MARK: Loop Count
/**
 * Configuration for {@link performTaskCountLoop} without an initial value.
 */
export interface PerformTaskCountLoopConfig<O> extends Omit<PerformTaskLoopConfig<O>, 'checkContinue'> {
  /** The number of iterations to perform. */
  count: number;
}

/**
 * Configuration for {@link performTaskCountLoop} with a required initial value.
 */
export interface PerformTaskCountLoopWithInitConfig<O> extends Omit<PerformTaskLoopWithInitConfig<O>, 'checkContinue'> {
  /** The number of iterations to perform. */
  count: number;
}

/**
 * Performs an async task loop a fixed number of times. A convenience wrapper around
 * {@link performTaskLoop} that automatically checks the iteration count.
 *
 * @param config - Loop configuration with the iteration count and next-value producer.
 * @returns The final value produced by the last iteration.
 */
export function performTaskCountLoop<O>(config: PerformTaskCountLoopWithInitConfig<O>): Promise<O>;
export function performTaskCountLoop<O>(config: PerformTaskCountLoopConfig<O>): Promise<Maybe<O>>;
export function performTaskCountLoop(config: PerformTaskCountLoopConfig<void>): Promise<void>;
export function performTaskCountLoop<O>(config: PerformTaskCountLoopWithInitConfig<O> | PerformTaskCountLoopConfig<O>): Promise<O> {
  return performTaskLoop<O>({
    ...config,
    checkContinue: (_, i) => i < config.count
  } as PerformTaskLoopConfig<O>);
}

// MARK: Loop Make
/**
 * A function that creates a single item in a {@link performMakeLoop} iteration.
 *
 * @param i - The current iteration index.
 * @param made - The array of items created so far.
 */
export type PerformMakeLoopFunction<O> = (i: number, made: O[]) => Promise<O>;

/**
 * Configuration for {@link performMakeLoop}.
 */
export interface PerformMakeLoopConfig<O> {
  /** The factory function to create each item. */
  make: PerformMakeLoopFunction<O>;
  /** The total number of items to create. */
  count: number;
}

/**
 * Creates an array of items by invoking a make function in a loop a specified number of times.
 * Each iteration receives the current index and the array of items created so far.
 *
 * @param config - Configuration with the make function and count.
 * @returns An array of all created items.
 */
export function performMakeLoop<O>(config: PerformMakeLoopConfig<O>): Promise<O[]> {
  return performTaskCountLoop<O[]>({
    count: config.count,
    initValue: [] as O[],
    next: async (i, accumulator: O[]) => {
      const result: O = await config.make(i, accumulator);
      accumulator.push(result);
      return accumulator;
    }
  });
}

// MARK: Batch Loop
/**
 * A function that creates a batch of items in a {@link performBatchLoop} iteration.
 *
 * @param itemsToMake - The number of items to create in this batch.
 * @param i - The current batch index.
 * @param made - The array of batches created so far.
 */
export type PerformBatchLoopFunction<O> = (itemsToMake: number, i: number, made: O[][]) => Promise<O[]>;

/**
 * Configuration for {@link performBatchLoop}.
 */
export interface PerformBatchLoopConfig<O> extends BatchCount {
  /**
   * Factory function that creates a batch of items given the requested count.
   */
  make: PerformBatchLoopFunction<O>;
}

/**
 * Creates items in batches by dividing a total count into batch-sized chunks and
 * invoking the make function for each batch.
 *
 * @param config - Configuration with the make function and batch count parameters.
 * @returns A two-dimensional array where each inner array is a batch of created items.
 */
export function performBatchLoop<O>(config: PerformBatchLoopConfig<O>): Promise<O[][]> {
  const { make } = config;
  const calc = batchCalc(config);
  const { batchCount } = calc;

  return performMakeLoop({
    count: batchCount,
    make: async (i, made: O[][]) => {
      const itemsToMake = itemCountForBatchIndex(i, calc);
      const batch: O[] = await make(itemsToMake, i, made);
      return batch;
    }
  });
}
