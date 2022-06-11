import { concatArrays, flattenArray, mergeArrays } from './array';
import { PrimativeKey, ReadKeyFunction } from '../key';
import { Maybe } from '../value/maybe.type';
import { filterMaybeValues } from './array.value';
import { removeFromSet } from '../set/set';

export function concatArraysUnique<T extends PrimativeKey = PrimativeKey>(...arrays: Maybe<T[]>[]): T[] {
  return unique(concatArrays(...arrays));
}

export function flattenArrayUnique<T extends PrimativeKey = PrimativeKey>(array: T[][]): T[] {
  return unique(flattenArray(array));
}

export function unique<T extends PrimativeKey = PrimativeKey>(values: T[], exclude?: T[]): T[] {
  const unique = new Set(values);

  if (exclude != null && exclude.length) {
    removeFromSet(unique, exclude);
  }

  return Array.from(unique);
}

export function findUnique<T, K extends PrimativeKey = PrimativeKey>(models: T[], readKey: ReadKeyFunction<T, K>, additionalKeys: K[] = []): T[] {
  const keys = new Set<Maybe<K>>(additionalKeys);

  return models.filter((x) => {
    const key = readKey(x);

    if (!keys.has(key)) {
      keys.add(key);
      return true;
    }

    return false;
  });
}

/**
 * Finds unique values in the input.
 *
 * Can also specify additional keys to exclude.
 */
export type FindUniqueFunction<T> = (input: T[], exclude?: T[]) => T[];

/**
 * Creates a FindUniqueFunction.
 *
 * @param readKey
 * @param additionalKeys
 * @returns
 */
export function makeFindUniqueFunction<T, K extends PrimativeKey = PrimativeKey>(readKey: ReadKeyFunction<T, K>, additionalKeys: K[] = []): FindUniqueFunction<T> {
  return (input: T[], exclude?: T[]) => findUnique(input, readKey, exclude ? mergeArrays([filterMaybeValues(exclude.map(readKey)), additionalKeys]) : additionalKeys);
}
