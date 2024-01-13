import { type ArrayOrValue, asArray } from './../array/array';
import { type Maybe, type MaybeNot } from '../value/maybe.type';

/**
 * Creates a Maybe Set with the input.
 *
 * If the input is an array or value, they are returned as a set. Otherwise, returns null/undefined.
 *
 * @param input
 * @returns
 */
export function maybeSet<T>(input: Maybe<ArrayOrValue<T>>): Maybe<Set<T>> {
  if (input != null) {
    return new Set(asArray(input));
  } else {
    return input as MaybeNot;
  }
}
