import { hasValueOrNotEmpty, hasNonNullValue } from '../value/maybe';
import { type Maybe, type MaybeNot } from '../value/maybe.type';

/**
 * Filters all maybe values from the input array. If a maybe value is input, returns an empty array.
 *
 * @param values
 * @returns
 */
export function filterMaybeValues<T>(values: Maybe<Maybe<T>[]>): T[] {
  if (values != null) {
    return values.filter(hasNonNullValue);
  } else {
    return [];
  }
}

/**
 * Filters all empty and maybe values from the input array. If a maybe value is input, returns an empty array.
 *
 * @param values
 * @returns
 */
export function filterEmptyValues<T>(values: Maybe<Maybe<T>[]>): T[] {
  if (values != null) {
    return values.filter(hasValueOrNotEmpty);
  } else {
    return [];
  }
}

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
