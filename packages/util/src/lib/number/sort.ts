import { type SortCompareFunction } from '../sort';
import { type ReadNumberFunction } from './number';

// MARK: Number
/**
 * SortCompareFunction by string.
 */
export type SortByNumberFunction<T> = SortCompareFunction<T>;

/**
 * Creates a {@link SortCompareFunction} that sorts values in ascending order by a numeric property.
 *
 * @param readNumberFn - Function that extracts the numeric value from each item.
 * @returns A sort comparator function for ascending numeric order.
 *
 * @dbxUtil
 * @dbxUtilCategory number
 * @dbxUtilKind factory
 * @dbxUtilTags number, sort, compare, ascending, factory
 * @dbxUtilRelated sort-numbers-ascending-function, sort-by-string-function
 *
 * @__NO_SIDE_EFFECTS__
 */
export function sortByNumberFunction<T>(readNumberFn: ReadNumberFunction<T>): SortByNumberFunction<T> {
  return (a: T, b: T) => {
    const as = readNumberFn(a);
    const bs = readNumberFn(b);
    return as - bs;
  };
}

/**
 * Pre-built sort comparator for sorting plain numbers in ascending order.
 */
export const sortNumbersAscendingFunction: SortByNumberFunction<number> = sortByNumberFunction<number>((a) => a);
