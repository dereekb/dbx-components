import { type Configurable } from '../type';

/**
 * A deconstructed Promise exposing its `resolve` and `reject` functions alongside the Promise itself.
 * Useful for controlling Promise resolution from outside the executor.
 */
export type PromiseReference<O = unknown> = {
  readonly promise: Promise<O>;
  readonly resolve: (value: O | PromiseLike<O>) => void;
  readonly reject: (reason?: unknown) => void;
};

/**
 * An executor function for a Promise, matching the signature of the native Promise constructor callback.
 *
 * @param resolve - Resolves the Promise with a value.
 * @param reject - Rejects the Promise with a reason.
 */
export type PromiseExecutor<O> = (resolve: (value: O | PromiseLike<O>) => void, reject: (reason?: unknown) => void) => void;

let PROMISE_REF_NUMBER = 0;

/**
 * Creates a new {@link PromiseReference} containing a Promise and its externally accessible
 * `resolve` and `reject` functions. An optional executor can be provided to run initialization
 * logic inside the Promise constructor.
 *
 * @param executor - An optional executor function invoked inside the Promise constructor.
 * @returns A PromiseReference with the created Promise and its control functions.
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
