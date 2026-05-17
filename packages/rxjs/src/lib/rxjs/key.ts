import { objectKeyEqualityComparatorFunction, type PrimativeKey, type ReadKeyFunction, type ReadMultipleKeysFunction, objectKeysEqualityComparatorFunction } from '@dereekb/util';
import { distinctUntilChanged, type MonoTypeOperatorFunction } from 'rxjs';

/**
 * `distinctUntilChanged` variant for arrays that only emits when the set of keys extracted from
 * the array elements changes.
 *
 * @param readKey - Function to extract one or more keys from each element.
 * @returns An operator that filters out arrays with unchanged key sets.
 */
export function distinctUntilKeysChange<T, K extends PrimativeKey = PrimativeKey>(readKey: ReadKeyFunction<T, K> | ReadMultipleKeysFunction<T, K>): MonoTypeOperatorFunction<T[]> {
  return distinctUntilChanged<T[]>(objectKeysEqualityComparatorFunction(readKey));
}

/**
 * `distinctUntilChanged` variant for single objects that only emits when the extracted key changes.
 *
 * @param readKey - Function to extract a key from the emitted object.
 * @returns An operator that filters out emissions with unchanged keys.
 */
export function distinctUntilObjectKeyChange<T>(readKey: ReadKeyFunction<T>): MonoTypeOperatorFunction<T> {
  return distinctUntilChanged<T>(objectKeyEqualityComparatorFunction(readKey));
}
