import { concatArrays } from "./array";
import { ReadKeyFunction } from "./key";
import { caseInsensitiveString } from "./string";
import { Maybe } from "./value";

export function concatArraysUnique<T extends string | number = string | number>(...arrays: (Maybe<T[]>)[]): T[] {
  return unique(concatArrays(...arrays));
}

export function flattenArrayUniqueCaseInsensitiveStrings(array: string[][]): string[] {
  return unique(flattenArray(array).map(caseInsensitiveString));
}

export function flattenArrayUnique<T extends string | number = string | number>(array: T[][]): T[] {
  return unique(flattenArray(array));
}

export function flattenArray<T>(array: T[][]): T[] {
  return array.filter((x) => Boolean(x)).reduce((accumulator, value) => accumulator.concat([...value]), []);
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

// MARK: Strings
export function findUniqueCaseInsensitiveStrings<T, K extends string = string>(models: T[], readKey: ReadKeyFunction<T, K>, additionalKeys: K[] = []): T[] {
  return findUnique(models, (key) => caseInsensitiveString(readKey(key)), additionalKeys.map(caseInsensitiveString));
}
