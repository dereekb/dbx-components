import { Maybe } from "../value";

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
export function performTaskLoop<O>(config: any): Promise<O> {
  return new Promise<O>(async (resolve, reject) => {
    try {
      let startLoop = config.initValue == null || config.checkContinue(config.initValue, -1);

      if (startLoop) {
        let i = 0;
        let prevValue: Maybe<O> = config.initValue;
        let check: boolean;

        do {
          prevValue = await config.next(i, prevValue);
          i += 1;
          check = config.checkContinue(prevValue, i);
        } while (check);

        resolve(prevValue!);
      } else {
        resolve(config.initValue);
      }
    } catch (e) {
      reject(e);
    }
  });
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
export function performTaskCountLoop<O>(config: any): Promise<O> {
  return performTaskLoop<O>({
    ...config,
    checkContinue: (_, i) => (i < config.count)
  }) as any;
}

// MARK: Loop Make
export interface PerformMakeLoopConfig<O> {
  make: (i: number, made: O[]) => Promise<O>,
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
