import { concatArrays, flattenArray } from "./array";
import { containsAnyValue } from "./array.set";
import { unique, findUnique } from "./array.unique";
import { ReadKeyFunction } from "./key";
import { caseInsensitiveString } from "./string";

export function toCaseInsensitiveStringArray(values: string[]): string[] {
  return values.map<string>(caseInsensitiveString);
}

export function flattenArrayUniqueCaseInsensitiveStrings(array: string[][]): string[] {
  return unique(flattenArray<string>(array).map<string>(caseInsensitiveString));
}

export function findUniqueCaseInsensitiveStrings<T, K extends string = string>(models: T[], readKey: ReadKeyFunction<T, K>, additionalKeys: K[] = []): T[] {
  return findUnique(models, (key) => caseInsensitiveString(readKey(key)), toCaseInsensitiveStringArray(additionalKeys));
}

export function containsStringNoCase(values: string[], valueToFind: string): boolean {
  return containsAnyStringNoCase(values, [valueToFind]);
}

export function containsAnyStringNoCase(values: string[], valuesToFind: string[]): boolean {
  return containsAnyValue(toCaseInsensitiveStringArray(values), toCaseInsensitiveStringArray(valuesToFind));
}
