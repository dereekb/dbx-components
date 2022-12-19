import { PrimativeKey, ReadKeyFunction, readKeysFunction, readKeysSetFunction, ReadMultipleKeysFunction, setContainsAllValues } from '@dereekb/util';
import { distinctUntilChanged, MonoTypeOperatorFunction } from 'rxjs';

/**
 * distinctUntilChanged() that reads the unique identifiers from the input values and compares them for uniqueness.
 *
 * @param readkey
 */
export function distinctUntilKeysChange<T, K extends PrimativeKey = PrimativeKey>(readKey: ReadKeyFunction<T, K> | ReadMultipleKeysFunction<T, K>): MonoTypeOperatorFunction<T[]> {
  const readKeysSet = readKeysSetFunction(readKey);
  const readKeysArray = readKeysFunction(readKey);

  return distinctUntilChanged((a: T[], b: T[]) => {
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
 * Convenience function for distinctUntilChange() that compares the values using a readKey function.
 *
 * @param readKey
 * @returns
 */
export function distinctUntilObjectKeyChange<T>(readKey: ReadKeyFunction<T>): MonoTypeOperatorFunction<T> {
  return distinctUntilChanged<T>((a, b) => (a != null && b != null ? readKey(a) === readKey(b) : a === b));
}
