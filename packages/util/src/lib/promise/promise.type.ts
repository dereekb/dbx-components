/**
 * A promise or a value.
 */
export type PromiseOrValue<T> = Promise<T> | T;

/**
 * Convenience function for calling Promise.resolve
 *
 * @param input
 * @returns
 */
export function asPromise<T>(input: PromiseOrValue<T>): Promise<T> {
  return Promise.resolve(input);
}
