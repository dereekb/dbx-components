import { concatArrays, flattenArray } from "./array";
import { ReadKeyFunction } from "./key";
import { Maybe } from "./value";

export function concatArraysUnique<T extends string | number = string | number>(...arrays: (Maybe<T[]>)[]): T[] {
  return unique(concatArrays(...arrays));
}

export function flattenArrayUnique<T extends string | number = string | number>(array: T[][]): T[] {
  return unique(flattenArray(array));
}

export function unique<T extends string | number = string | number>(values: T[]): T[] {
  return Array.from(new Set(values));
}

export function findUnique<T, K extends string | number = string | number>(models: T[], readKey: ReadKeyFunction<T, K>, additionalKeys: K[] = []): T[] {
  const keys = new Set<K>(additionalKeys);

  return models.filter((x) => {
    const key = readKey(x);

    if (!keys.has(key)) {
      keys.add(key);
      return true;
    }

    return false;
  });
}
