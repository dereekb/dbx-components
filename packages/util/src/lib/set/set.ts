import { Maybe } from '../value/maybe.type';
import { flattenArray } from '../array/array';
import { asIterable, IterableOrValue, useIterableOrValue } from '../iterable/iterable';
import { symmetricDifference } from 'extra-set';

export function asSet<T>(values: IterableOrValue<T>): Set<T> {
  let set: Set<T>;

  if (typeof values === 'string') {
    set = new Set([values]);
  } else {
    set = new Set();
    addToSet(set, values);
  }

  return set;
}

export function copySetAndDo<T>(set: Set<T>, fn: (set: Set<T>) => void): Set<T> {
  const newSet = new Set(set);
  fn(newSet);
  return newSet;
}

export function addToSetCopy<T>(set: Set<T>, values: Maybe<IterableOrValue<T>>): Set<T> {
  return copySetAndDo(set, (x) => addToSet(x, values));
}

export function addToSet<T>(set: Set<T>, values: Maybe<IterableOrValue<T>>) {
  useIterableOrValue(values, (x) => set.add(x));
}

export function removeFromSetCopy<T>(set: Set<T>, values: Maybe<IterableOrValue<T>>): Set<T> {
  return copySetAndDo(set, (x) => removeFromSet(x, values));
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
  const filterFn = exclude ? (x: T) => !set.has(x) : (x: T) => set.has(x);
  return values.filter(filterFn);
}

/**
 * Set inclusion comparison type.
 * - all: The set must include all values from values (set is a subset of values)
 * - all_reverse: All values must be included in the set (values is a subset of set)
 * - any: Any value from values is in the set
 */
export type SetIncludesMode = 'all' | 'any';

/**
 * Contextual function that checks whether or not the input values are included.
 */
export type SetIncludesFunction<T> = (valuesToFind: IterableOrValue<T>) => boolean;

/**
 * Creates a SetIncludesFunction using the input valuesSet and optional mode. By default the mode defaults to 'all'.
 *
 * @param valuesSet
 * @param valuesToFind
 * @param mode
 */
export function setIncludesFunction<T>(valuesSet: Set<T>, mode: SetIncludesMode = 'all'): SetIncludesFunction<T> {
  let fn: (set: Set<T>, values: IterableOrValue<T>) => boolean;

  if (mode === 'any') {
    fn = setContainsAnyValue;
  } else {
    fn = setContainsAllValues;
  }

  return (valuesToFind) => fn(valuesSet, valuesToFind);
}

/**
 * Convenience function for calling setIncludesFunction() and passing the result a value, checking for includion.
 *
 * @param valuesSet
 * @param valuesToFind
 * @param mode
 * @returns
 */
export function setIncludes<T>(valuesSet: Set<T>, valuesToFind: IterableOrValue<T>, mode?: SetIncludesMode): boolean {
  return setIncludesFunction(valuesSet, mode)(valuesToFind);
}

/**
 * Returns true if the input array contains any value from the second array.
 */
export function containsAnyValue<T>(values: IterableOrValue<T>, valuesToFind: IterableOrValue<T>): boolean {
  const set = new Set(asIterable(valuesToFind, false));
  return containsAnyValueFromSet(values, set);
}

export function containsAnyValueFromSet<T>(values: IterableOrValue<T>, valuesToFind: Set<T>): boolean {
  return setContainsAnyValue(valuesToFind, values);
}

export function setContainsAnyValue<T>(valuesSet: Set<T>, valuesToFind: IterableOrValue<T>): boolean {
  return valuesSet ? Array.from(asIterable(valuesToFind)).findIndex((x) => valuesSet.has(x)) !== -1 : false;
}

/**
 * Returns true if values contains all values in valuesToFind.
 *
 * @param values
 * @param valuesToFind
 * @returns
 */
export function containsAllValues<T>(values: Iterable<T>, valuesToFind: IterableOrValue<T>): boolean {
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
export function setContainsAllValues<T>(valuesSet: Set<T>, valuesToFind: IterableOrValue<T>): boolean {
  return valuesSet ? Array.from(asIterable(valuesToFind)).findIndex((x) => !valuesSet.has(x)) == -1 : false;
}
