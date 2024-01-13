import { type Configurable } from '../type';

/**
 * A reference to a Promise and its resolve/reject functions.
 */
export type PromiseReference<O = unknown> = {
  readonly promise: Promise<O>;
  readonly resolve: (value: O | PromiseLike<O>) => void;
  readonly reject: (reason?: unknown) => void;
};

export type PromiseExecutor<O> = (resolve: (value: O | PromiseLike<O>) => void, reject: (reason?: unknown) => void) => void;

let PROMISE_REF_NUMBER = 0;

/**
 * Creates a new promise and returns the full ref for it.
 */
export function promiseReference<O>(executor?: PromiseExecutor<O>): PromiseReference<O> {
  const ref = {} as Configurable<PromiseReference<O>> & { number: number };

  ref.promise = new Promise((resolve, reject) => {
    ref.resolve = resolve;
    ref.reject = reject;
    executor?.(resolve, reject);
  });

  ref.number = PROMISE_REF_NUMBER += 1; // added for debugging

  return ref;
}
