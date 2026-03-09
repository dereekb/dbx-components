import { type Maybe } from '../value/maybe.type';

/**
 * A Node.js-style error-first callback function.
 *
 * @param err - An optional error. If provided, indicates failure.
 */
export type PromiseCallback = (err?: Maybe<Error>) => void;

/**
 * A function that receives a {@link PromiseCallback} and invokes it to signal completion or failure.
 *
 * @param cb - The callback to invoke when the async operation completes.
 */
export type UsePromiseCallback = (cb: PromiseCallback) => void;

/**
 * Wraps a callback-based async operation as a Promise. The provided function receives a
 * Node.js-style error-first callback; calling it with an error rejects the promise, and
 * calling it without an error resolves it.
 *
 * @param use - A function that performs an async operation and signals completion via the provided callback.
 * @returns A Promise that resolves when the callback is invoked without an error, or rejects with the provided error.
 */
export async function useCallback(use: UsePromiseCallback): Promise<void> {
  return new Promise((resolve, reject) => {
    const callback = (err?: Maybe<Error>) => {
      if (err != null) {
        reject(err);
      } else {
        resolve();
      }
    };

    use(callback);
  });
}
