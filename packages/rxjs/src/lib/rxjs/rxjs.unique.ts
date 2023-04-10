import { filterUniqueFunction, FilterUniqueFunctionAdditionalKeysInput, PrimativeKey, ReadKeyFunction } from '@dereekb/util';
import { map, MonoTypeOperatorFunction } from 'rxjs';

/**
 * Convenience function for building an OperatorFunction that uses filterUniqueFunction().
 *
 * @param readKey
 * @param additionalKeys
 */
export function filterUnique<T, K extends PrimativeKey = PrimativeKey>(readKey: ReadKeyFunction<T, K>, additionalKeysInput?: FilterUniqueFunctionAdditionalKeysInput<T, K>): MonoTypeOperatorFunction<T[]> {
  const filterFn = filterUniqueFunction<T, K>(readKey, additionalKeysInput);
  return map((x) => filterFn(x));
}
