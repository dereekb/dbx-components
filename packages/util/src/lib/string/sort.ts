import { type SortCompareFunction } from '../sort';
import { type ReadStringFunction } from './string';

/**
 * SortCompareFunction by string.
 */
export type SortByStringFunction<T> = SortCompareFunction<T>;

/**
 * Creates a {@link SortByStringFunction} that sorts values in ascending alphabetical order using `localeCompare`.
 *
 * @param readStringFn - Function to extract a string from each value for comparison.
 * @returns A comparator function suitable for use with `Array.sort()`.
 */
export function sortByStringFunction<T>(readStringFn: ReadStringFunction<T>): SortByStringFunction<T> {
  return (a: T, b: T) => {
    const as = readStringFn(a);
    const bs = readStringFn(b);
    return as.localeCompare(bs);
  };
}

// MARK: Configured
/**
 * Input type for objects that can be sorted by their `label` property.
 */
export interface SortByLabelInput {
  label: string;
}

/**
 * Pre-configured sort comparator that sorts objects by their `label` property in ascending alphabetical order.
 */
export const sortByLabelFunction: SortByStringFunction<SortByLabelInput> = sortByStringFunction((x) => x.label);
