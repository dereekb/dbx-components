import { SORT_VALUE_LESS_THAN, SORT_VALUE_GREATER_THAN, SORT_VALUE_EQUAL, compareFnOrder, type SortingOrder, type SortCompareFunction, copyArray } from '@dereekb/util';
import { type ReadDateFunction, type ReadISO8601DateStringUTCFullFunction } from './date';

/**
 * A {@link SortCompareFunction} that sorts items by a Date value.
 */
export type SortByDateFunction<T> = SortCompareFunction<T>;

/**
 * Creates a sort comparison function that orders items in ascending date order using the provided reader.
 *
 * @param readDateFn - extracts a Date from each item
 * @returns a comparison function for use with Array.sort()
 *
 * @example
 * ```ts
 * const events = [{ at: new Date('2024-03-01') }, { at: new Date('2024-01-01') }];
 * events.sort(sortByDateFunction((e) => e.at));
 * // events[0].at === '2024-01-01'
 * ```
 */
export function sortByDateFunction<T>(readDateFn: ReadDateFunction<T>): SortByDateFunction<T> {
  return (a: T, b: T) => {
    const ad = readDateFn(a);
    const bd = readDateFn(b);
    return ad.getTime() - bd.getTime();
  };
}

/**
 * A {@link SortCompareFunction} that sorts items by an ISO 8601 date string.
 */
export type SortByISO8601DateStringFunction<T> = SortCompareFunction<T>;

/**
 * Creates a sort comparison function that orders items in ascending order by lexicographic comparison of ISO 8601 date strings.
 *
 * @param readDateFn - extracts an ISO 8601 date string from each item
 * @returns a comparison function for use with Array.sort()
 *
 * @example
 * ```ts
 * const items = [{ d: '2024-03-01T00:00:00Z' }, { d: '2024-01-01T00:00:00Z' }];
 * items.sort(sortByISO8601DateStringFunction((x) => x.d));
 * // items[0].d === '2024-01-01T00:00:00Z'
 * ```
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
 * Returns a sorted copy of the input array, ordered by ISO 8601 date strings extracted from each item.
 *
 * @param values - the items to sort
 * @param readDate - extracts an ISO 8601 date string from each item
 * @param order - optional sorting order ('asc' or 'desc', defaults to ascending)
 * @returns a new sorted array (does not mutate the original)
 *
 * @example
 * ```ts
 * const items = [{ d: '2024-03-01T00:00:00Z' }, { d: '2024-01-01T00:00:00Z' }];
 * const sorted = sortByISO8601DateStrings(items, (x) => x.d);
 * // sorted[0].d === '2024-01-01T00:00:00Z'
 * ```
 */
export function sortByISO8601DateStrings<T>(values: T[], readDate: ReadISO8601DateStringUTCFullFunction<T>, order?: SortingOrder): T[] {
  const valuesToSort = copyArray(values);
  const sortAscendingFn = sortByISO8601DateStringFunction<T>(readDate);
  valuesToSort.sort(compareFnOrder(sortAscendingFn, order));
  return valuesToSort;
}
