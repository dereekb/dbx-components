import { filterMaybeValues } from '../array/array.value';
import { Maybe } from '../value/maybe.type';

/**
 * Contains a reference to a filter object.
 */
export interface Filter<F> {
  filter?: F;
}

export type OptionalFilter<F> = Partial<Filter<F>>;

export type FilterFunction<T = unknown> = (value: T, index: number) => boolean;

/**
 * Merges the input FilterFunction values into a single FilterFunction.
 *
 * @param inputFilters
 * @returns
 */
export function mergeFilterFunctions<T>(...inputFilters: Maybe<FilterFunction<T>>[]): FilterFunction<T> {
  const filters = filterMaybeValues(inputFilters);
  let filter: FilterFunction<T>;

  switch (filters.length) {
    case 0:
      filter = () => true;
      break;
    case 1:
      filter = filters[0];
      break;
    default:
      filter = (value, i) => filters.findIndex((filter) => !filter(value, i)) === -1;
      break;
  }

  return filter;
}

/**
 * Used to invert a filter function by returning the opposite of what it returns.
 *
 * @param filterFn
 * @param invert whether or not to apply the inversion.
 * @returns
 */
export function invertFilter<T = unknown, F extends FilterFunction<T> = FilterFunction<T>>(filterFn: F, invert = true): F {
  if (invert) {
    return ((value: T, index: number) => {
      const result: boolean = filterFn.call(null, value, index);
      return !result;
    }) as F;
  } else {
    return filterFn;
  }
}
