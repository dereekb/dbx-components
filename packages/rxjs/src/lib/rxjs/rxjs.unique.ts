import { filterUniqueFunction, type FilterUniqueFunctionAdditionalKeysInput, type PrimativeKey, type ReadKeyFunction } from '@dereekb/util';
import { map, type MonoTypeOperatorFunction } from 'rxjs';

/**
 * RxJS operator that filters an array to unique items based on a key reader function.
 *
 * Uses {@link filterUniqueFunction} to deduplicate emitted arrays by extracting a key from each item.
 *
 * @param readKey - function to extract the unique key from each item
 * @param additionalKeysInput - optional additional keys to include in the unique set
 * @returns an operator that emits deduplicated arrays
 */
export function filterUnique<T, K extends PrimativeKey = PrimativeKey>(readKey: ReadKeyFunction<T, K>, additionalKeysInput?: FilterUniqueFunctionAdditionalKeysInput<T, K>): MonoTypeOperatorFunction<T[]> {
  const filterFn = filterUniqueFunction<T, K>(readKey, additionalKeysInput);
  return map((x) => filterFn(x));
}
