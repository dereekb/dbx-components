import { Maybe } from '../value/maybe';
import { flattenArray } from "../array/array";
import { IterableOrValue, useIterableOrValue } from '../iterable/iterable';
import { symmetricDifference } from "extra-set";

export function addToSet<T>(set: Set<T>, values: Maybe<IterableOrValue<T>>) {
  useIterableOrValue(values, (x) => set.add(x));
}

export function removeFromSet<T>(set: Set<T>, values: Maybe<IterableOrValue<T>>) {
  useIterableOrValue(values, (x) => set.delete(x));
}

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
 * Set inclusion comparison type.
 * - all: All values must be included
 * - any: Any value is included
 */
export type SetIncludesMode = 'all' | 'any';

/**
 * Contextual function that checks whether or not the input values are included.
 */
export type SetIncludesFunction<T> = (valuesToFind: Iterable<T>) => boolean;

/**
 * Creates a SetIncludesFunction using the input valuesSet and optional mode. By default the mode defaults to 'all'.
 * 
 * @param valuesSet 
 * @param valuesToFind 
 * @param mode 
 */
export function setIncludesFunction<T>(valuesSet: Set<T>, mode: SetIncludesMode = 'all'): SetIncludesFunction<T> {
  let fn: (set: Set<T>, values: Iterable<T>) => boolean;

  if (mode === 'any') {
    fn = setContainsAnyValue;
  } else {
    fn = setContainsAllValues;
  }

  return (valuesToFind) => fn(valuesSet, valuesToFind);
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
