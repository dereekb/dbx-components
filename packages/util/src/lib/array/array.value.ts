import { hasValueOrNotEmpty, hasNonNullValue } from '../value/maybe';
import { type Maybe, type MaybeNot } from '../value/maybe.type';

/**
 * Function that takes the input and returns an array with no Maybe values.
 */
export type FilterMaybeArrayFunction<T> = (value: Maybe<Maybe<T[]>>) => T[];
export type UniversalFilterMaybeArrayFunction = <T>(values: Maybe<Maybe<T>[]>) => T[];

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
 * @param values
 * @returns
 */
export const filterMaybeArrayValues = filterMaybeArrayFunction(hasNonNullValue) as UniversalFilterMaybeArrayFunction;

/**
 * Filters all empty and maybe values from the input array. If a maybe value is input, returns an empty array.
 *
 * @param values
 * @returns
 */
export const filterEmptyArrayValues = filterMaybeArrayFunction(hasValueOrNotEmpty) as UniversalFilterMaybeArrayFunction;

/**
 * Checks whether or not all values are MaybeNot values.
 *
 * @param values
 * @returns
 */
export function allValuesAreMaybeNot<T>(values: Maybe<T>[]): values is MaybeNot[] {
  return values.findIndex((x) => x != null) === -1;
}

/**
 * Checks whether or not all values are non-MaybeNot values.
 *
 * @param values
 * @returns
 */
export function allValuesAreNotMaybe<T>(values: Maybe<T>[]): values is T[] {
  return values.findIndex((x) => x == null) === -1;
}

// MARK: Compat
/**
 * Filters all maybe values from the input array. If a maybe value is input, returns an empty array.
 *
 * @param values
 * @returns
 *
 * @deprecated use filterMaybeArrayValues instead.
 */
export const filterMaybeValues = filterMaybeArrayValues;

/**
 * Filters all empty and maybe values from the input array. If a maybe value is input, returns an empty array.
 *
 * @param values
 * @returns
 *
 * @deprecated use filterEmptyArrayValues instead.
 */
export const filterEmptyValues = filterEmptyArrayValues;
