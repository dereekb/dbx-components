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

/**
 * Creates a new SortCompareFunction that can sort values of one type mapped to another type and sorted with a different sort function.
 *
 * @param mapValue
 * @param sortValuesFunction
 * @returns
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
}

/**
 * Sorts the input values using the input.
 *
 * @param input
 * @returns
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
 * Creates a SortValuesFunction using the input.
 *
 * @param sortRef
 * @returns
 */
export function sortValuesFunctionWithSortRef<T>(sortRef: Maybe<Partial<SortCompareFunctionRef<T>>>, sortOnCopyDefault: boolean = true): SortValuesFunction<T> {
  const sortWith = sortRef?.sortWith;
  return (values: T[], sortOnCopy = sortOnCopyDefault) => sortValues<T>({ values, sortOnCopy, sortWith });
}

/**
 * Creates a SortValuesFunction using the input. If the input is not defined, or it's sort function is not defined, then returns mapIdentityFunction().
 */
export function sortValuesFunctionOrMapIdentityWithSortRef<T>(sortRef: Maybe<Partial<SortCompareFunctionRef<T>>>, sortOnCopyDefault?: boolean): SortValuesFunction<T> {
  const sortWith = sortRef?.sortWith;
  return sortWith ? sortValuesFunctionWithSortRef(sortRef, sortOnCopyDefault) : mapIdentityFunction();
}

/**
 * Equivalent to sortValuesFunctionOrMapIdentityWithSortRef(), but returns a SimpleSortValuesFunction instead.
 *
 * @param sortRef
 * @param sortOnCopyDefault
 * @returns
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
