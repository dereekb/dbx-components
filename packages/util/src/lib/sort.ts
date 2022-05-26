export type SortingOrder = 'desc' | 'asc';

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
 *
 * In "descending" order, this returns the opposite values as "ascending".
 */
export type SortComparisonNumber = number;

/**
 * A comparison function that returns a SortComparisonNumber.
 */
export type SortCompareFunction<T> = (a: T, b: T) => SortComparisonNumber;

/**
 * Comparison function that sorts in ascending order.
 *
 * This is the logical normal return order, where if an item is less than another, it should return SORT_VALUE_LESS_THAN (-1), etc.
 */
export type AscendingSortCompareFunction<T> = SortCompareFunction<T>;

/**
 * Comparison function that sorts in descending order.
 *
 * This is the logical normal return order, where if an item is less than another, it should return SORT_VALUE_LESS_THAN (-1), etc.
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
