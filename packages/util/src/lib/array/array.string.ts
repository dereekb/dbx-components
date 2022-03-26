import { flattenArray } from "./array";
import { unique, findUnique } from "./array.unique";
import { ReadKeyFunction } from "../key";
import { caseInsensitiveString } from "../string";
import { containsAllValues, containsAnyValue, hasDifferentValues } from "../set/set";
import { mapIterable } from "./array.iterable";

export function hasDifferentStringsNoCase(a: string[], b: string[]): boolean {
  return hasDifferentValues(a.map(caseInsensitiveString), b.map(caseInsensitiveString));
}

export function toCaseInsensitiveStringArray(values: Iterable<string>): string[] {
  return mapIterable<string, string>(values, caseInsensitiveString);
}

export function uniqueCaseInsensitiveStrings(values: Iterable<string>): string[] {
  return Array.from(uniqueCaseInsensitiveStringsSet(values));
}

export function uniqueCaseInsensitiveStringsSet(values: Iterable<string>): Set<string> {
  return new Set(toCaseInsensitiveStringArray(values));
}

export function flattenArrayUniqueCaseInsensitiveStrings(array: string[][]): string[] {
  return unique(flattenArray<string>(array).map<string>(caseInsensitiveString));
}

export function findUniqueCaseInsensitiveStrings<T, K extends string = string>(models: T[], readKey: ReadKeyFunction<T, K>, additionalKeys: K[] = []): T[] {
  return findUnique(models, (x: T) => caseInsensitiveString(readKey(x)), toCaseInsensitiveStringArray(additionalKeys));
}

export function containsStringAnyCase(values: Iterable<string>, valueToFind: string): boolean {
  return containsAnyStringAnyCase(values, [valueToFind]);
}

export function containsAnyStringAnyCase(values: Iterable<string>, valuesToFind: Iterable<string>): boolean {
  return containsAnyValue(toCaseInsensitiveStringArray(values), toCaseInsensitiveStringArray(valuesToFind));
}

export function containsAllStringsAnyCase(values: Iterable<string>, valuesToFind: Iterable<string>): boolean {
  const valuesToFindArray = toCaseInsensitiveStringArray(valuesToFind);
  return (valuesToFindArray.length) ? containsAllValues(toCaseInsensitiveStringArray(values), valuesToFindArray) : true;
}
