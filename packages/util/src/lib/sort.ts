import { firstValueFromIterable, forEachInIterable } from './iterable/iterable';
import { type MapFunction, mapIdentityFunction, type MapSameFunction } from './value/map';
import { type Maybe, type MaybeMap } from './value/maybe.type';

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
 * An object that has a reference to a SortCompareFunction<T> function.
 */
export interface SortCompareFunctionRef<T> {
  /**
   * Sort comparison function to sort with.
   */
  readonly sortWith: SortCompareFunction<T>;
}

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
 *
 * @param compareFn - the comparison function whose order should be reversed
 * @returns a new comparison function with the opposite sort direction
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
 *
 * @param ascendingCompareFn - a comparison function that sorts in ascending order
 * @param order - the desired sort direction; defaults to 'asc'
 * @returns the original function if ascending, or a reversed version if descending
 */
export function compareFnOrder<T>(ascendingCompareFn: AscendingSortCompareFunction<T>, order: SortingOrder = 'asc'): SortCompareFunction<T> {
  return order === 'asc' ? ascendingCompareFn : reverseCompareFn(ascendingCompareFn);
}

/**
 * Creates a {@link SortCompareFunction} that maps values to a different type before comparing.
 * Useful for sorting objects by a derived property.
 *
 * @param mapValue - Maps each value to the type used for comparison.
 * @param comparesFunction - Compares the mapped values.
 * @returns A sort comparison function for the original type.
 *
 * @example
 * ```ts
 * const byName = compareWithMappedValuesFunction(
 *   (user: { name: string }) => user.name,
 *   (a, b) => a.localeCompare(b)
 * );
 * [{ name: 'Bob' }, { name: 'Alice' }].sort(byName);
 * // [{ name: 'Alice' }, { name: 'Bob' }]
 * ```
 */
export function compareWithMappedValuesFunction<T, V>(mapValue: MapFunction<T, V>, comparesFunction: SortCompareFunction<V>): SortCompareFunction<T> {
  return (a, b) => {
    const vA = mapValue(a);
    const vB = mapValue(b);
    return comparesFunction(vA, vB);
  };
}

/**
 * Simple SortValuesFunction that only sorts the input and has no configuration.
 */
export type SimpleSortValuesFunction<T> = MapSameFunction<T[]>;

/**
 * Function that sorts the input values array. Can be configured to return a copy.
 */
export type SortValuesFunction<T> = (values: T[], sortOnCopy?: boolean) => T[];

/**
 * Input for sortValues().
 */
export type SortValuesInput<T> = MaybeMap<Partial<SortCompareFunctionRef<T>>> & {
  /**
   * Values to sort.
   */
  readonly values: T[];
  /**
   * Whether or not to sort on a copy of the input values.
   */
  readonly sortOnCopy?: Maybe<boolean>;
  /**
   * Whether or not to always return a copy of the input values, even if no sorting occurs.
   */
  readonly alwaysReturnCopy?: Maybe<boolean>;
};

/**
 * Sorts values using the configuration in {@link SortValuesInput}. Optionally sorts on a copy to avoid mutating the original array.
 *
 * @param input - Configuration including values, sort function, and copy behavior.
 * @returns The sorted array (may be the original or a copy depending on configuration).
 */
export function sortValues<T>(input: SortValuesInput<T>): T[] {
  const { values, alwaysReturnCopy, sortOnCopy, sortWith } = input;
  const doSort = sortWith != null;
  let result = values;

  if (alwaysReturnCopy || (sortOnCopy && doSort)) {
    result = [...values];
  }

  if (doSort) {
    result = result.sort(sortWith);
  }

  return result;
}

/**
 * Creates a {@link SortValuesFunction} from a {@link SortCompareFunctionRef}.
 *
 * @param sortRef - Reference containing the sort comparison function.
 * @param sortOnCopyDefault - Whether to sort on a copy by default (default: true).
 * @returns A function that sorts arrays using the configured comparison.
 */
export function sortValuesFunctionWithSortRef<T>(sortRef: Maybe<Partial<SortCompareFunctionRef<T>>>, sortOnCopyDefault: boolean = true): SortValuesFunction<T> {
  const sortWith = sortRef?.sortWith;
  return (values: T[], sortOnCopy = sortOnCopyDefault) => sortValues<T>({ values, sortOnCopy, sortWith });
}

/**
 * Creates a SortValuesFunction using the input. If the input is not defined, or it's sort function is not defined, then returns mapIdentityFunction().
 *
 * @param sortRef - optional reference containing the sort comparison function
 * @param sortOnCopyDefault - whether to sort on a copy by default
 * @returns a sort function that sorts arrays, or the identity function if no sort comparison is configured
 */
export function sortValuesFunctionOrMapIdentityWithSortRef<T>(sortRef: Maybe<Partial<SortCompareFunctionRef<T>>>, sortOnCopyDefault?: boolean): SortValuesFunction<T> {
  const sortWith = sortRef?.sortWith;
  return sortWith ? sortValuesFunctionWithSortRef(sortRef, sortOnCopyDefault) : mapIdentityFunction();
}

/**
 * Equivalent to {@link sortValuesFunctionOrMapIdentityWithSortRef}, but returns a {@link SimpleSortValuesFunction} instead.
 *
 * @param sortRef - Reference containing the sort comparison function.
 * @param sortOnCopyDefault - Whether to sort on a copy by default.
 * @returns A simple sort function or identity function.
 */
export const simpleSortValuesFunctionWithSortRef: <T>(sortRef: Maybe<Partial<SortCompareFunctionRef<T>>>, sortOnCopyDefault?: boolean) => SimpleSortValuesFunction<T> = sortValuesFunctionOrMapIdentityWithSortRef;

// MARK: Min/Max
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
 * Creates a {@link MinAndMaxFunction} that finds the minimum and maximum values from an iterable using the provided comparison function.
 *
 * @param compareFn - Ascending sort comparison function used to determine min/max.
 * @returns A function that returns `{ min, max }` or `null` for empty iterables.
 *
 * @example
 * ```ts
 * const fn = minAndMaxFunction<number>((a, b) => a - b);
 * fn([3, 1, 4, 1, 5]); // { min: 1, max: 5 }
 * fn([]);               // null
 * ```
 */
export function minAndMaxFunction<T>(compareFn: SortCompareFunction<T>): MinAndMaxFunction<T> {
  return (values: Iterable<T>) => {
    let min: Maybe<T> = firstValueFromIterable(values) ?? undefined;
    let max: Maybe<T> = min;

    if (min == null || max == null) {
      return null;
    }

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
  };
}
