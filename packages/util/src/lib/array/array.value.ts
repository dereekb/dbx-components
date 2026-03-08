import { hasValueOrNotEmpty, hasNonNullValue } from '../value/maybe';
import { type Maybe, type MaybeNot } from '../value/maybe.type';

/**
 * Function that takes an optional array of optional values and returns a filtered array with no Maybe values.
 */
export type FilterMaybeArrayFunction<T> = (value: Maybe<Maybe<T[]>>) => T[];

/**
 * A generic variant of {@link FilterMaybeArrayFunction} that works with any element type.
 */
export type UniversalFilterMaybeArrayFunction = <T>(values: Maybe<Maybe<T>[]>) => T[];

/**
 * Creates a {@link FilterMaybeArrayFunction} that filters maybe values from an array using the provided filter function.
 *
 * @param filterFn - Filter predicate used to determine which values to keep.
 * @returns A function that filters maybe values from an optional input array.
 */
export function filterMaybeArrayFunction<T>(filterFn: Parameters<Array<Maybe<T>>['filter']>[0]): FilterMaybeArrayFunction<T> {
  return ((values: Maybe<Maybe<T[]>>) => {
    if (values != null) {
      return values.filter(filterFn);
    } else {
      return [];
    }
  }) as FilterMaybeArrayFunction<T>;
}

/**
 * Filters all maybe values from the input array. If a maybe value is input, returns an empty array.
 *
 * @param values - Optional array of optional values to filter.
 * @returns An array containing only non-null and non-undefined values.
 */
export const filterMaybeArrayValues = filterMaybeArrayFunction(hasNonNullValue) as UniversalFilterMaybeArrayFunction;

/**
 * Filters all empty and maybe values from the input array. If a maybe value is input, returns an empty array.
 *
 * @param values - Optional array of optional values to filter.
 * @returns An array containing only non-null, non-undefined, and non-empty values.
 */
export const filterEmptyArrayValues = filterMaybeArrayFunction(hasValueOrNotEmpty) as UniversalFilterMaybeArrayFunction;

/**
 * Checks whether or not all values in the array are {@link MaybeNot} (null or undefined).
 *
 * @param values - Array of optional values to check.
 * @returns `true` if every value in the array is null or undefined.
 */
export function allValuesAreMaybeNot<T>(values: Maybe<T>[]): values is MaybeNot[] {
  return values.findIndex((x) => x != null) === -1;
}

/**
 * Checks whether or not all values in the array are defined (non-null and non-undefined).
 *
 * @param values - Array of optional values to check.
 * @returns `true` if every value in the array is non-null and non-undefined.
 */
export function allValuesAreNotMaybe<T>(values: Maybe<T>[]): values is T[] {
  return values.findIndex((x) => x == null) === -1;
}
