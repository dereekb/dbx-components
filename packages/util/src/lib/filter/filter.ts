import { filterMaybeArrayValues } from '../array/array.value';
import { invertBooleanReturnFunction } from '../function/function.boolean';
import { type Maybe } from '../value/maybe.type';

/**
 * Contains a reference to a filter object.
 */
export interface Filter<F> {
  filter?: F;
}

/**
 * A filter reference where the filter is optional.
 */
export type OptionalFilter<F> = Partial<Filter<F>>;

/**
 * Function used for filtering items that takes in a value and index.
 */
export type FilterFunction<T = unknown> = (value: T, index: number) => boolean;

/**
 * Merges multiple FilterFunction values into a single FilterFunction.
 * The merged function returns true only if all individual filters pass (AND logic).
 * Null/undefined filters are ignored.
 *
 * @param inputFilters - The filter functions to merge
 * @returns A single FilterFunction that applies all filters
 */
export function mergeFilterFunctions<T>(...inputFilters: Maybe<FilterFunction<T>>[]): FilterFunction<T> {
  const filters = filterMaybeArrayValues(inputFilters);
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
 * Inverts a filter function so it returns the opposite boolean value.
 *
 * @param filterFn - The filter function to invert
 * @param invert - Whether to apply the inversion (defaults to true)
 * @returns The inverted filter function, or the original if invert is false
 */
export const invertFilter: <T = unknown, F extends FilterFunction<T> = FilterFunction<T>>(filterFn: F, invert?: boolean) => F = invertBooleanReturnFunction;
