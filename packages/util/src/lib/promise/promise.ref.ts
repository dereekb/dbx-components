import { Configurable } from '../type';


export interface PromiseFullRef<O = unknown> {
  readonly promise: Promise<O>;
  readonly resolve: (value: O | PromiseLike<O>) => void;
  readonly reject: (reason?: unknown) => void;
}

export type PromiseExecutor<O> = (resolve: (value: O | PromiseLike<O>) => void, reject: (reason?: unknown) => void) => void;

let PROMISE_REF_NUMBER = 0;

/**
 * Creates a new promise and returns the full ref for it.
 */
export function makePromiseFullRef<O>(executor: PromiseExecutor<O>): PromiseFullRef<O> {
  const ref = {} as Configurable<PromiseFullRef<O>> & { number: number };

  ref.promise = new Promise((resolve, reject) => {
    ref.resolve = resolve;
    ref.reject = reject;
    executor(resolve, reject);
  });

  ref.number = PROMISE_REF_NUMBER += 1;  // added for debugging

  return ref;
}
