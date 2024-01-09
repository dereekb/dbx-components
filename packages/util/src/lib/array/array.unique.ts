import { concatArrays, flattenArray, mergeArrays } from './array';
import { PrimativeKey, ReadKeyFunction } from '../key';
import { Maybe } from '../value/maybe.type';
import { filterMaybeValues } from './array.value';
import { addToSet, removeFromSet } from '../set/set';

export function concatArraysUnique<T extends PrimativeKey = PrimativeKey>(...arrays: Maybe<T[]>[]): T[] {
  return unique(concatArrays(...arrays));
}

export function flattenArrayUnique<T extends PrimativeKey = PrimativeKey>(array: T[][]): T[] {
  return unique(flattenArray(array));
}

/**
 * Filters the input values and only returns unique values.
 *
 * @param values
 * @param exclude
 * @returns
 */
export function unique<T extends PrimativeKey = PrimativeKey>(values: T[], excludeInput?: FilterUniqueFunctionExcludeKeysInput<T, T>): T[] {
  const unique = new Set(values);
  const exclude = readKeysFromFilterUniqueFunctionAdditionalKeysInput<T>(excludeInput, (x) => x) as T[];

  if (exclude != null && exclude.length) {
    removeFromSet(unique, exclude);
  }

  return Array.from(unique);
}

/**
 * Finds unique values in the input.
 *
 * Can also specify additional values to exclude.
 */
export type FilterUniqueFunction<T, K extends PrimativeKey = PrimativeKey> = (input: T[], exclude?: FilterUniqueFunctionExcludeKeysInput<T, K>) => T[];

export type FilterUniqueFunctionAdditionalKeysInput<T, K extends PrimativeKey = PrimativeKey> = K[] | FilterUniqueFunctionAdditionalKeys<T, K>;
export type FilterUniqueFunctionExcludeKeysInput<T, K extends PrimativeKey = PrimativeKey> = T[] | FilterUniqueFunctionAdditionalKeys<T, K>;

export interface FilterUniqueFunctionAdditionalKeys<T, K extends PrimativeKey = PrimativeKey> {
  readonly keys?: Maybe<K[]>;
  readonly values?: Maybe<T[]>;
}

export function readKeysFromFilterUniqueFunctionAdditionalKeysInput<T, K extends PrimativeKey = PrimativeKey>(additionalKeysInput: Maybe<FilterUniqueFunctionAdditionalKeysInput<T, K>>, readKey: ReadKeyFunction<T, K>): K[] {
  return filterMaybeValues(additionalKeysInput != null ? (Array.isArray(additionalKeysInput) ? additionalKeysInput : readKeysFromFilterUniqueFunctionAdditionalKeys<T, K>(additionalKeysInput, readKey)) : []);
}

export function readKeysFromFilterUniqueFunctionAdditionalKeys<T, K extends PrimativeKey = PrimativeKey>(input: FilterUniqueFunctionAdditionalKeys<T, K>, readKey: ReadKeyFunction<T, K>): Maybe<K>[] {
  const keys = new Set<Maybe<K>>(input.keys);

  if (input.values) {
    addToSet(keys, input.values.map(readKey));
  }

  return Array.from(keys);
}

/**
 * Creates a FilterUniqueFunction.
 *
 * @param readKey
 * @param additionalKeys
 * @returns
 */
export function filterUniqueFunction<T, K extends PrimativeKey = PrimativeKey>(readKey: ReadKeyFunction<T, K>, additionalKeysInput?: FilterUniqueFunctionAdditionalKeysInput<T, K>): FilterUniqueFunction<T, K> {
  const baseKeys: K[] = readKeysFromFilterUniqueFunctionAdditionalKeysInput(additionalKeysInput, readKey);

  function calculateExclude(excludeInput?: FilterUniqueFunctionExcludeKeysInput<T, K>): K[] {
    const newExcludeKeys = excludeInput ? (Array.isArray(excludeInput) ? excludeInput.map(readKey) : readKeysFromFilterUniqueFunctionAdditionalKeys(excludeInput, readKey)) : [];
    return newExcludeKeys?.length ? mergeArrays([filterMaybeValues(newExcludeKeys), baseKeys]) : baseKeys;
  }

  return (input: T[], excludeInput?: FilterUniqueFunctionExcludeKeysInput<T, K>) => {
    const exclude = calculateExclude(excludeInput);
    const keys = new Set<Maybe<K>>(exclude);

    const result: T[] = input.filter((x) => {
      const key: Maybe<K> = readKey(x);

      if (!keys.has(key)) {
        keys.add(key);
        return true;
      }

      return false;
    });

    return result;
  };
}

export function filterUniqueValues<T, K extends PrimativeKey = PrimativeKey>(values: T[], readKey: ReadKeyFunction<T, K>, additionalKeys: K[] = []): T[] {
  return filterUniqueFunction(readKey, additionalKeys)(values);
}
