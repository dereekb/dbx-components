import { SORT_VALUE_LESS_THAN, SORT_VALUE_GREATER_THAN, SORT_VALUE_EQUAL, compareFnOrder, SortingOrder, SortCompareFunction, copyArray } from '@dereekb/util';
import { ReadDateFunction, ReadISO8601DateStringUTCFullFunction } from './date';

/**
 * SortCompareFunction by Date
 */
export type SortByDateFunction<T> = SortCompareFunction<T>;

/**
 * Creates a SortByNumberFunction that sorts values in ascending order.
 */
export function sortByDateFunction<T>(readDateFn: ReadDateFunction<T>): SortByDateFunction<T> {
  return (a: T, b: T) => {
    const ad = readDateFn(a);
    const bd = readDateFn(b);
    return ad.getTime() - bd.getTime();
  };
}

/**
 * SortCompareFunction by Date
 */
export type SortByISO8601DateStringFunction<T> = SortCompareFunction<T>;

/**
 * Creates a SortByNumberFunction that sorts values in ascending order.
 */
export function sortByISO8601DateStringFunction<T>(readDateFn: ReadISO8601DateStringUTCFullFunction<T>): SortByISO8601DateStringFunction<T> {
  return (a: T, b: T) => {
    const aDate = readDateFn(a);
    const bDate = readDateFn(b);

    // Lexiographical comparison of the ISO8601 Date strings.
    return aDate < bDate ? SORT_VALUE_LESS_THAN : aDate > bDate ? SORT_VALUE_GREATER_THAN : SORT_VALUE_EQUAL;
  };
}

/**
 * Sorts the input values by ISO8601DateStringUTCFull values from the input models.
 *
 * @param values
 * @param readDate
 * @param order
 * @returns
 */
export function sortByISO8601DateStrings<T>(values: T[], readDate: ReadISO8601DateStringUTCFullFunction<T>, order?: SortingOrder): T[] {
  const valuesToSort = copyArray(values);
  const sortAscendingFn = sortByISO8601DateStringFunction<T>(readDate);
  valuesToSort.sort(compareFnOrder(sortAscendingFn, order));
  return valuesToSort;
}
