import { firstValueFromIterable, forEachInIterable } from './iterable/iterable';
import { Maybe } from './value/maybe.type';

export type SortingOrder = 'asc' | 'desc';

export const SORT_VALUE_LESS_THAN: SortComparisonNumber = -1;
export const SORT_VALUE_GREATER_THAN: SortComparisonNumber = 1;
export const SORT_VALUE_EQUAL: SortComparisonNumber = 0;

/**
 * A number that is the result of comparison two items.
 *
 * In "ascending" order, a value:
 * - smaller than another will return -1 (or less).
 * - equal to another will return 0
 * - greater than another will return 1 (or more).
 * - Example: a - b
 *
 * In "descending" order, this returns the opposite values as "ascending".
 * - Example: b - a
 */
export type SortComparisonNumber = number;

/**
 * A comparison function that returns a SortComparisonNumber.
 */
export type SortCompareFunction<T> = (a: T, b: T) => SortComparisonNumber;

/**
 * Comparison function that sorts in ascending order.
 */
export type AscendingSortCompareFunction<T> = SortCompareFunction<T>;

/**
 * Comparison function that sorts in descending order.
 */
export type SortDescendingCompareFunction<T> = SortCompareFunction<T>;

/**
 * Convenience function that reverses the order of the sorted values.
 */
export function reverseCompareFn<T>(compareFn: AscendingSortCompareFunction<T>): SortDescendingCompareFunction<T>;
export function reverseCompareFn<T>(compareFn: SortDescendingCompareFunction<T>): AscendingSortCompareFunction<T>;
export function reverseCompareFn<T>(compareFn: SortCompareFunction<T>): SortCompareFunction<T> {
  return (a: T, b: T) => compareFn(a, b) * -1;
}

/**
 * Convenience function that reverses the order of the sorted values if the order is specified descending.
 *
 * The input comparison function must be in ascending order.
 */
export function compareFnOrder<T>(ascendingCompareFn: AscendingSortCompareFunction<T>, order: SortingOrder = 'asc'): SortCompareFunction<T> {
  return order === 'asc' ? ascendingCompareFn : reverseCompareFn(ascendingCompareFn);
}

export interface MinAndMax<T> {
  min: T;
  max: T;
}

export type MinAndMaxFunctionResult<T> = MinAndMax<T> | null;

/**
 * Returns the min and maximum value from the input values.
 *
 * If the input iterable is empty, then returns undefined.
 */
export type MinAndMaxFunction<T> = (values: Iterable<T>) => MinAndMaxFunctionResult<T>;

/**
 * Creates a MinAndMaxFunction using the input compare.
 *
 * @param compare
 */
export function minAndMaxFunction<T>(compareFn: SortCompareFunction<T>): MinAndMaxFunction<T> {
  return (values: Iterable<T>) => {
    let min: Maybe<T> = firstValueFromIterable(values) ?? undefined;
    let max: Maybe<T> = min;

    if (min != null && max != null) {
      forEachInIterable(values, (x) => {
        const compareMin = compareFn(x, min as T);
        const compareMax = compareFn(x, max as T);

        if (compareMin < 0) {
          min = x;
        }

        if (compareMax > 0) {
          max = x;
        }
      });

      return { min, max };
    } else {
      return null;
    }
  };
}
