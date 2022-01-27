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
export function performTaskLoop<O>(config: PerformTaskLoopConfig<O>): Promise<Maybe<O>>;
export function performTaskLoop<O>(config: PerformTaskLoopWithInitConfig<O>): Promise<O>;
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
