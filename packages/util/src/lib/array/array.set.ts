import { PrimativeKey } from '../key';
import { symmetricDifference } from "extra-set";
import { flattenArray } from "./array";
import { caseInsensitiveString } from "../string";
import { Maybe } from '../value';

// MARK: Functions
export function flattenArrayToSet<T>(array: T[][]): Set<T> {
  return new Set(flattenArray(array));
}

export function hasDifferentValues<T>(a: T[], b: T[]): boolean {
  return a.length !== b.length || symmetricDifference(new Set(a), new Set(b)).size > 0;
}

export function hasDifferentStringsNoCase(a: string[], b: string[]): boolean {
  return hasDifferentValues(a.map(caseInsensitiveString), b.map(caseInsensitiveString));
}

export function symmetricDifferenceKeys<T extends PrimativeKey = PrimativeKey>(a: Maybe<T>[], b: Maybe<T>[]): Maybe<T>[] {
  return symmetricDifferenceKeysSet(new Set(a), new Set(b));
}

export function symmetricDifferenceKeysSet<T>(a: Set<Maybe<T>>, b: Set<Maybe<T>>): Maybe<T>[] {
  return Array.from(symmetricDifference(a, b));
}

/**
 * Returns items that exist in both arrays.
 */
export function keepValuesFromArray<T>(values: T[], secondArray: T[]): T[] {
  return keepValuesFromSet(values, new Set<T>(secondArray));
}

export function keepValuesFromSet<T>(values: T[], set: Set<T>): T[] {
  return filterValuesFromSet(values, set, false);
}

export function excludeValuesFromArray<T>(values: T[], secondArray: T[]): T[] {
  return excludeValuesFromSet(values, new Set<T>(secondArray));
}

export function excludeValuesFromSet<T>(values: T[], set: Set<T>): T[] {
  return filterValuesFromSet(values, set, true);
}

export function filterValuesFromSet<T>(values: T[], set: Set<T>, exclude = false): T[] {
  const filterFn = (exclude) ? ((x: T) => !set.has(x)) : ((x: T) => set.has(x));
  return values.filter(filterFn);
}

/**
 * Returns true if the input array contains any value from the second array.
 */
export function containsAnyValue<T>(values: Iterable<T>, valuesToFind: Iterable<T>): boolean {
  const set = new Set(valuesToFind);
  return containsAnyValueFromSet(values, set);
}

export function containsAnyValueFromSet<T>(values: Iterable<T>, valuesToFind: Set<T>): boolean {
  return setContainsAnyValue(valuesToFind, values);
}

export function setContainsAnyValue<T>(valuesSet: Set<T>, valuesToFind: Iterable<T>): boolean {
  return (valuesSet) ? Array.from(valuesToFind).findIndex((x) => valuesSet.has(x)) !== -1 : false;
}
