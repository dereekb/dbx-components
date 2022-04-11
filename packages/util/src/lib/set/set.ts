import { Maybe } from '../value/maybe';
import { symmetricDifference } from "extra-set";
import { flattenArray } from "../array/array";

export function hasDifferentValues<T>(a: Maybe<Iterable<T>>, b: Maybe<Iterable<T>>): boolean {
  return symmetricDifference(new Set(a), new Set(b)).size > 0;
}

export function symmetricDifferenceKeys<T>(a: Maybe<Iterable<T>>, b: Maybe<Iterable<T>>): Maybe<T>[] {
  return symmetricDifferenceKeysSet(new Set(a), new Set(b));
}

export function symmetricDifferenceKeysSet<T>(a: Set<Maybe<T>>, b: Set<Maybe<T>>): Maybe<T>[] {
  return Array.from(symmetricDifference(a, b));
}

export function flattenArrayToSet<T>(array: T[][]): Set<T> {
  return new Set(flattenArray(array));
}

export function keepValuesFromSet<T>(values: T[], set: Set<T>): T[] {
  return filterValuesFromSet(values, set, false);
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

/**
 * Returns true if values contains all values in valuesToFind.
 * 
 * @param values 
 * @param valuesToFind 
 * @returns 
 */
export function containsAllValues<T>(values: Iterable<T>, valuesToFind: Iterable<T>): boolean {
  const set = new Set(values);
  return setContainsAllValues(set, valuesToFind);
}

/**
 * Returns true if valuesSet contains all values in valuesToFind.
 * 
 * @param valuesSet 
 * @param valuesToFind 
 * @param returnOnEmptyValuesSet 
 * @returns 
 */
export function setContainsAllValues<T>(valuesSet: Set<T>, valuesToFind: Iterable<T>): boolean {
  return (valuesSet) ? Array.from(valuesToFind).findIndex((x) => !valuesSet.has(x)) == -1 : false;
}
