export type IterateFn<T> = (value: T) => void | Promise<void>;
export type IteratePageFn<T> = (values: T[]) => void | Promise<void>;

/**
 * Async iteration over the input values in-order.
 */
export async function iterate<T>(values: T[], useFn: IterateFn<T>): Promise<void> {
  for (let i = 0; i < values.length; i += 1) {
    await useFn(values[i]);
  }
}
