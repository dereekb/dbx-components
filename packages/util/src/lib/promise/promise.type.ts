/**
 * A value that may be either a Promise resolving to T, or a synchronous value of type T.
 */
export type PromiseOrValue<T> = Promise<T> | T;

/**
 * Wraps the input in a resolved Promise if it is not already a Promise.
 *
 * @param input - A value or Promise to normalize into a Promise.
 * @returns Resolves to the input value.
 *
 * @dbxUtil
 * @dbxUtilCategory promise
 * @dbxUtilTags promise, async, normalize, resolve, ensure
 */
export function asPromise<T>(input: PromiseOrValue<T>): Promise<T> {
  return Promise.resolve(input);
}
