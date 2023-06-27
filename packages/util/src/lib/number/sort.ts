import { SortCompareFunction } from '../sort';
import { ReadNumberFunction } from './number';

/**
 * SortCompareFunction by string.
 */
export type SortByNumberFunction<T> = SortCompareFunction<T>;

/**
 * Creates a SortByNumberFunction that sorts values in ascending order.
 */
export function sortByNumberFunction<T>(readNumberFn: ReadNumberFunction<T>): SortByNumberFunction<T> {
  return (a: T, b: T) => {
    const as = readNumberFn(a);
    const bs = readNumberFn(b);
    return as - bs;
  };
}

export const sortNumbersAscendingFunction: SortByNumberFunction<number> = sortByNumberFunction<number>((a) => a);
