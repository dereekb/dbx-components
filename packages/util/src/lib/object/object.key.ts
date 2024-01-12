import { PrimativeKey, ReadKeyFunction, ReadMultipleKeysFunction, readKeysSetFunction, readKeysFunction } from '../key';
import { setContainsAllValues } from '../set/set';
import { Maybe } from '../value/maybe.type';
import { EqualityComparatorFunction, safeEqualityComparatorFunction } from '../value/comparator';

/**
 * Creates a EqualityComparatorFunction that compares the two input values
 *
 * @param readKey
 * @returns
 */
export function objectKeysEqualityComparatorFunction<T, K extends PrimativeKey = PrimativeKey>(readKey: ReadKeyFunction<T, K> | ReadMultipleKeysFunction<T, K>): EqualityComparatorFunction<Maybe<T[]>> {
  const readKeysSet = readKeysSetFunction(readKey);
  const readKeysArray = readKeysFunction(readKey);

  return safeEqualityComparatorFunction((a: T[], b: T[]) => {
    if (a.length === b.length) {
      if (a.length === 0) {
        return true; // both the same/empty arrays
      }

      const aKeys = readKeysSet(a);
      const bKeys = readKeysArray(b);

      if (aKeys.size === bKeys.length) {
        return setContainsAllValues(aKeys, bKeys);
      }
    }

    return false;
  });
}

/**
 * Creates a EqualityComparatorFunction that compares the two input values
 *
 * @param readKey
 * @returns
 */
export function objectKeyEqualityComparatorFunction<T, K extends PrimativeKey = PrimativeKey>(readKey: ReadKeyFunction<T, K>): EqualityComparatorFunction<Maybe<T>> {
  return safeEqualityComparatorFunction((a, b) => readKey(a) === readKey(b));
}
