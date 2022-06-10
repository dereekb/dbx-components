import { batchCalc, BatchCount, batch, itemCountForBatchIndex } from '../grouping';
import { Maybe } from '../value/maybe.type';

export interface PerformTaskLoopConfig<O> {
  next: (i: number, prev: Maybe<O>) => Promise<O>;
  checkContinue: (prev: Maybe<O>, i: number) => boolean;
}

export interface PerformTaskLoopWithInitConfig<O> {
  initValue: O;
  next: (i: number, prev: O) => Promise<O>;
  checkContinue: (prev: O, i: number) => boolean;
}

// MARK: Loop
export function performTaskLoop<O>(config: PerformTaskLoopWithInitConfig<O>): Promise<O>;
export function performTaskLoop<O>(config: PerformTaskLoopConfig<O>): Promise<O>;
export function performTaskLoop<O>(config: PerformTaskLoopConfig<O>): Promise<Maybe<O>>;
export function performTaskLoop(config: PerformTaskLoopConfig<void>): Promise<void>;
export async function performTaskLoop<O>(config: PerformTaskLoopWithInitConfig<O> | PerformTaskLoopConfig<O>): Promise<O> {
  let result: O;
  const initValue = (config as PerformTaskLoopWithInitConfig<O>).initValue;
  const startLoop = initValue == null || config.checkContinue(initValue, -1);

  if (startLoop) {
    let i = 0;
    let prevValue: Maybe<O> = initValue;
    let check: boolean;

    do {
      prevValue = await config.next(i, prevValue);
      i += 1;
      check = config.checkContinue(prevValue, i);
    } while (check);

    result = prevValue;
  } else {
    result = initValue;
  }

  return result;
}

// MARK: Loop Count
export interface PerformTaskCountLoopConfig<O> extends Omit<PerformTaskLoopConfig<O>, 'checkContinue'> {
  count: number;
}

export interface PerformTaskCountLoopWithInitConfig<O> extends Omit<PerformTaskLoopWithInitConfig<O>, 'checkContinue'> {
  count: number;
}

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
export interface PerformMakeLoopConfig<O> {
  make: (i: number, made: O[]) => Promise<O>;
  count: number;
}

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
export interface PerformBatchLoopConfig<O> extends BatchCount {
  /**
   * Makes a certain number of items.
   */
  make: (itemsToMake: number, i: number, made: O[][]) => Promise<O[]>;
}

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
