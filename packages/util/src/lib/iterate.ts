/**
 * Callback invoked for each value during iteration. May be sync or async.
 */
export type IterateFn<T> = (value: T) => void | Promise<void>;

/**
 * Callback invoked for each page of values during iteration. May be sync or async.
 */
export type IteratePageFn<T> = (values: T[]) => void | Promise<void>;

/**
 * Iterates over each value in the array sequentially, awaiting each callback before proceeding to the next.
 *
 * @param values - Array of values to iterate over.
 * @param useFn - Callback invoked for each value.
 *
 * @example
 * ```ts
 * await iterate([1, 2, 3], async (value) => {
 *   await processItem(value);
 * });
 * ```
 */
export async function iterate<T>(values: T[], useFn: IterateFn<T>): Promise<void> {
  for (let i = 0; i < values.length; i += 1) {
    await useFn(values[i]);
  }
}
