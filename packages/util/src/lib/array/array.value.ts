import { Maybe, MaybeNot } from '../value/maybe';

export function filterMaybeValues<T>(values: Maybe<Maybe<T>[]>): T[] {
  if (values) {
    return values.filter(filterMaybeValuesFn);
  } else {
    return [];
  }
}

export function filterMaybeValuesFn<T>(value: Maybe<T>): value is T {
  return value != null;
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
