import { SORT_VALUE_LESS_THAN, SORT_VALUE_GREATER_THAN, SORT_VALUE_EQUAL, compareFnOrder, ISO8601DateStringUTCFull, SortingOrder } from "@dereekb/util";

/**
 * Sorts the input values by ISO8601DateStringUTCFull values from the input models.
 * 
 * @param values
 * @param readDate 
 * @param order 
 * @returns 
 */
export function sortByISO8601DateStrings<T>(values: T[], readDate: (value: T) => ISO8601DateStringUTCFull, order?: SortingOrder): T[] {
  const valuesToSort = [...values];

  const sortAscendingFn = function (a: T, b: T) {
    const aDate = readDate(a);
    const bDate = readDate(b);

    // Lexiographical comparison of the ISO8601 Date strings.
    return (aDate < bDate) ? SORT_VALUE_LESS_THAN : ((aDate > bDate) ? SORT_VALUE_GREATER_THAN : SORT_VALUE_EQUAL);
  };

  valuesToSort.sort(compareFnOrder(sortAscendingFn, order));

  return valuesToSort;
}
