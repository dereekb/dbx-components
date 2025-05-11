import { type ArrayOrValue, asArray } from './../array/array';
import { type Maybe } from '../value/maybe.type';
import { setContainsAnyValue } from './set';

/**
 * Pair of allowed/disallowed values.
 */
export interface AllowedSet<T> {
  /**
   * Values that are allowed. Hits against this set result in an initial true.
   */
  readonly allowed?: Maybe<Set<T>>;
  /**
   * Values that are disallowed. Hits against this set result in false.
   */
  readonly disallowed?: Maybe<Set<T>>;
}

/**
 * Determines whether the input values are "allowed" for the given AllowedSet.
 *
 * @param input
 * @param allowedSet
 * @returns
 */
export function isAllowed<T>(input: ArrayOrValue<T>, allowedSet: AllowedSet<T>): boolean {
  const { allowed, disallowed } = allowedSet;
  const values = asArray(input);

  let isAllowed = false;

  if (allowed) {
    isAllowed = setContainsAnyValue(allowed, values, true);
  } else {
    isAllowed = true;
  }

  if (isAllowed && disallowed) {
    isAllowed = !setContainsAnyValue(disallowed, values, true);
  }

  return isAllowed;
}
