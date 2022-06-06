import { concatArrays, flattenArray } from './array';
import { PrimativeKey, ReadKeyFunction } from '../key';
import { Maybe } from '../value/maybe';

export function concatArraysUnique<T extends PrimativeKey = PrimativeKey>(...arrays: Maybe<T[]>[]): T[] {
  return unique(concatArrays(...arrays));
}

export function flattenArrayUnique<T extends PrimativeKey = PrimativeKey>(array: T[][]): T[] {
  return unique(flattenArray(array));
}

export function unique<T extends PrimativeKey = PrimativeKey>(values: T[]): T[] {
  return Array.from(new Set(values));
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
 */
export type FindUniqueFunction<T> = (input: T[]) => T[];

/**
 * Creates a FindUniqueFunction.
 *
 * @param readKey
 * @param additionalKeys
 * @returns
 */
export function makeFindUniqueFunction<T, K extends PrimativeKey = PrimativeKey>(readKey: ReadKeyFunction<T, K>, additionalKeys: K[] = []): FindUniqueFunction<T> {
  return (input: T[]) => findUnique(input, readKey, additionalKeys);
}
