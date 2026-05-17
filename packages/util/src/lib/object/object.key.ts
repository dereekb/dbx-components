import { type PrimativeKey, type ReadKeyFunction, type ReadMultipleKeysFunction, readKeysSetFunction, readKeysFunction } from '../key';
import { setContainsAllValues } from '../set/set';
import { type Maybe } from '../value/maybe.type';
import { type EqualityComparatorFunction, safeEqualityComparatorFunction } from '../value/comparator';

/**
 * Creates an {@link EqualityComparatorFunction} that compares two arrays of objects by extracting keys
 * and checking that both arrays contain the same set of keys (order-independent).
 *
 * Returns `true` if both arrays have the same length and produce identical key sets.
 * Handles `null`/`undefined` inputs via {@link safeEqualityComparatorFunction}.
 *
 * @dbxUtil
 * @dbxUtilCategory object
 * @dbxUtilKind factory
 * @dbxUtilTags object, key, equality, comparator, factory, array
 * @dbxUtilRelated object-key-equality-comparator-function, safe-equality-comparator-function
 *
 * @param readKey - Function to extract one or more keys from each object
 * @returns An equality comparator for arrays of keyed objects
 * @__NO_SIDE_EFFECTS__
 */
export function objectKeysEqualityComparatorFunction<T, K extends PrimativeKey = PrimativeKey>(readKey: ReadKeyFunction<T, K> | ReadMultipleKeysFunction<T, K>): EqualityComparatorFunction<Maybe<T[]>> {
  const readKeysSet = readKeysSetFunction(readKey);
  const readKeysArray = readKeysFunction(readKey);

  return safeEqualityComparatorFunction((a: T[], b: T[]) => {
    let result = false;

    if (a.length === b.length) {
      if (a.length === 0) {
        result = true; // both the same/empty arrays
      } else {
        const aKeys = readKeysSet(a);
        const bKeys = readKeysArray(b);

        if (aKeys.size === bKeys.length) {
          result = setContainsAllValues(aKeys, bKeys);
        }
      }
    }

    return result;
  });
}

/**
 * Creates an {@link EqualityComparatorFunction} that compares two objects by extracting a single key
 * from each and checking strict equality.
 *
 * Handles `null`/`undefined` inputs via {@link safeEqualityComparatorFunction}.
 *
 * @dbxUtil
 * @dbxUtilCategory object
 * @dbxUtilKind factory
 * @dbxUtilTags object, key, equality, comparator, factory
 * @dbxUtilRelated object-keys-equality-comparator-function, safe-equality-comparator-function
 *
 * @param readKey - Function to extract the key from an object
 * @returns An equality comparator for keyed objects
 * @__NO_SIDE_EFFECTS__
 */
export function objectKeyEqualityComparatorFunction<T, K extends PrimativeKey = PrimativeKey>(readKey: ReadKeyFunction<T, K>): EqualityComparatorFunction<Maybe<T>> {
  return safeEqualityComparatorFunction((a, b) => readKey(a) === readKey(b));
}
