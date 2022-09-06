import { containsAllValues, PrimativeKey, ReadKeyFunction, readKeysFunction, readKeysSetFunction, readModelKeys, readModelKeysFromObjects, setContainsAllValues } from '@dereekb/util';
import { distinctUntilChanged, MonoTypeOperatorFunction } from 'rxjs';

/**
 * distinctUntilChanged() that reads the unique identifiers from the input values and compares them for uniqueness.
 *
 * @param readkey
 */
export function distinctUntilKeysChange<T, K extends PrimativeKey = PrimativeKey>(readKey: ReadKeyFunction<T, K>): MonoTypeOperatorFunction<T[]> {
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
