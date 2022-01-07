
export enum SortingOrder {
  ASCENDING = 'asc',
  DESCENDING = 'desc'
}

export type CompareFunction<T> = (a: T, b: T) => number;

/**
 * Convenience function that reverses the order of the sorted values.
 */
export function reverseCompareFn<T>(compareFn: CompareFunction<T>): CompareFunction<T> {
  return (a: T, b: T) => compareFn(a, b) * -1;
}

/**
 * Convenience function that reverses the order of the sorted values if the order is specified descending.
 * 
 * The input comparison function must be in ascending order.
 */
export function compareFnOrder<T>(ascendingCompareFn: CompareFunction<T>, order: SortingOrder = SortingOrder.ASCENDING): CompareFunction<T> {
  return (order === SortingOrder.ASCENDING) ? ascendingCompareFn : reverseCompareFn(ascendingCompareFn);
}
