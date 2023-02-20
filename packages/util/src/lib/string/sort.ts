import { SortCompareFunction } from '../sort';
import { ReadStringFunction } from './string';

/**
 * SortCompareFunction by string.
 */
export type SortByStringFunction<T> = SortCompareFunction<T>;

/**
 * Creates a SortByStringFunction that sorts values in ascending order.
 */
export function sortByStringFunction<T>(readStringFn: ReadStringFunction<T>): SortByStringFunction<T> {
  return (a: T, b: T) => {
    const as = readStringFn(a);
    const bs = readStringFn(b);
    return as.localeCompare(bs);
  };
}

// MARK: Configured
export interface SortByLabelInput {
  label: string;
}

export const sortByLabelFunction: SortByStringFunction<SortByLabelInput> = sortByStringFunction((x) => x.label);
