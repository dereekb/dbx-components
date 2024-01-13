import { objectKeyEqualityComparatorFunction, type PrimativeKey, type ReadKeyFunction, type ReadMultipleKeysFunction, objectKeysEqualityComparatorFunction } from '@dereekb/util';
import { distinctUntilChanged, type MonoTypeOperatorFunction } from 'rxjs';

/**
 * distinctUntilChanged() that reads the unique identifiers from the input values and compares them for uniqueness.
 *
 * @param readkey
 */
export function distinctUntilKeysChange<T, K extends PrimativeKey = PrimativeKey>(readKey: ReadKeyFunction<T, K> | ReadMultipleKeysFunction<T, K>): MonoTypeOperatorFunction<T[]> {
  return distinctUntilChanged<T[]>(objectKeysEqualityComparatorFunction(readKey));
}

/**
 * Convenience function for distinctUntilChange() that compares the values using a readKey function.
 *
 * @param readKey
 * @returns
 */
export function distinctUntilObjectKeyChange<T>(readKey: ReadKeyFunction<T>): MonoTypeOperatorFunction<T> {
  return distinctUntilChanged<T>(objectKeyEqualityComparatorFunction(readKey));
}
