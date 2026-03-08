import { type Maybe } from '../value/maybe.type';
import { flattenArray } from '../array/array';
import { asIterable, type IterableOrValue, iterableToArray, useIterableOrValue } from '../iterable/iterable';
import { symmetricDifference } from 'extra-set';
import { type PrimativeKey, type ReadKeyFunction, readKeysSetFrom } from '../key';
import { type SetIncludesMode } from './set.mode';
import { type DecisionFunction } from '../value/decision';
import { type MapFunction } from '../value/map';

/**
 * Represents a selection that is either everything or nothing.
 */
export type AllOrNoneSelection = 'all' | 'none';

/**
 * Converts an {@link IterableOrValue} into a Set. Strings are treated as single values rather than character iterables.
 *
 * @param values - The value or iterable to convert.
 * @returns A new Set containing all values.
 */
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

/**
 * Creates a copy of the set, applies the given function to the copy, and returns it.
 *
 * @param set - The set to copy, or null/undefined for an empty set.
 * @param fn - A function to mutate the copied set.
 * @returns The modified copy of the set.
 */
export function copySetAndDo<T>(set: Maybe<Set<T>>, fn: (set: Set<T>) => void): Set<T> {
  const newSet = new Set(set ?? undefined);
  fn(newSet);
  return newSet;
}

/**
 * Creates a copy of the set with the given values added.
 *
 * @param set - The set to copy, or null/undefined for an empty set.
 * @param values - The values to add to the copy.
 * @returns A new Set with the values added.
 */
export function addToSetCopy<T>(set: Maybe<Set<T>>, values: Maybe<IterableOrValue<T>>): Set<T> {
  return copySetAndDo(set, (x) => addToSet(x, values));
}

/**
 * Adds one or more values to the given set in place.
 *
 * @param set - The set to add values to.
 * @param values - The value or iterable of values to add.
 */
export function addToSet<T>(set: Set<T>, values: Maybe<IterableOrValue<T>>) {
  useIterableOrValue(values, (x) => set.add(x));
}

/**
 * Creates a copy of the set with the given values toggled (added if absent, removed if present).
 *
 * @param set - The set to copy.
 * @param values - The values to toggle.
 * @returns A new Set with the toggles applied.
 */
export function toggleInSetCopy<T>(set: Set<T>, values: Maybe<IterableOrValue<T>>): Set<T> {
  return copySetAndDo(set, (x) => toggleInSet(x, values));
}

/**
 * Toggles values in the set in place: adds if absent, removes if present.
 *
 * @param set - The set to modify.
 * @param values - The values to toggle.
 */
export function toggleInSet<T>(set: Set<T>, values: Maybe<IterableOrValue<T>>) {
  useIterableOrValue(values, (x) => {
    if (set.has(x)) {
      set.delete(x);
    } else {
      set.add(x);
    }
  });
}

/**
 * Creates a copy of the set with the given values removed.
 *
 * @param set - The set to copy, or null/undefined for an empty set.
 * @param values - The values to remove from the copy.
 * @returns A new Set with the values removed.
 */
export function removeFromSetCopy<T>(set: Maybe<Set<T>>, values: Maybe<IterableOrValue<T>>): Set<T> {
  return copySetAndDo(set, (x) => removeFromSet(x, values));
}

/**
 * Removes one or more values from the given set in place.
 *
 * @param set - The set to remove values from.
 * @param values - The value or iterable of values to remove.
 */
export function removeFromSet<T>(set: Set<T>, values: Maybe<IterableOrValue<T>>) {
  useIterableOrValue(values, (x) => set.delete(x));
}

/**
 * Returns true if both iterables contain the same set of values.
 *
 * @param a - First iterable.
 * @param b - Second iterable.
 * @returns `true` if the values are identical as sets.
 */
export function hasSameValues<T>(a: Maybe<Iterable<T>>, b: Maybe<Iterable<T>>): boolean {
  return !hasDifferentValues(a, b);
}

/**
 * Returns true if the two iterables contain different sets of values, or if either is null/undefined.
 *
 * @param a - First iterable.
 * @param b - Second iterable.
 * @returns `true` if the values differ.
 */
export function hasDifferentValues<T>(a: Maybe<Iterable<T>>, b: Maybe<Iterable<T>>): boolean {
  const setA = new Set(a);
  return a == null || b == null || !setContainsAllValues(setA, b) || setA.size !== new Set(b).size;
}

/**
 * Returns an array of values that exist in exactly one of the two iterables (symmetric difference).
 *
 * @param a - First iterable.
 * @param b - Second iterable.
 * @returns An array of values present in only one of the inputs.
 */
export function symmetricDifferenceArray<T>(a: Maybe<Iterable<T>>, b: Maybe<Iterable<T>>): Maybe<T>[] {
  return symmetricDifferenceArrayBetweenSets(new Set(a), new Set(b));
}

/**
 * Returns an array of the symmetric difference between two sets.
 *
 * @param a - First set.
 * @param b - Second set.
 * @returns An array of values present in only one of the sets.
 */
export function symmetricDifferenceArrayBetweenSets<T>(a: Set<Maybe<T>>, b: Set<Maybe<T>>): Maybe<T>[] {
  return Array.from(symmetricDifference(a, b));
}

/**
 * Flattens a two-dimensional array into a Set of unique values.
 *
 * @param array - The nested array to flatten.
 * @returns A Set containing all values from the nested arrays.
 */
export function flattenArrayToSet<T>(array: T[][]): Set<T> {
  return new Set(flattenArray(array));
}

/**
 * Returns a new Set containing only the values from the input that also exist in the given set.
 * If the input values are null or undefined, returns an empty set.
 *
 * @param set - The reference set to check membership against.
 * @param values - The values to filter.
 * @returns A Set of values that exist in both inputs.
 */
export function keepFromSetCopy<T>(set: Set<T>, values: Maybe<IterableOrValue<T>>): Set<T> {
  return values != null ? filterValuesToSet(asIterable(values), (x) => set.has(x)) : new Set();
}

/**
 * Filters the array to only include values that exist in the given set.
 *
 * @param values - The array to filter.
 * @param set - The set to check membership against.
 * @returns An array of values present in the set.
 */
export function keepValuesFromSet<T>(values: T[], set: Set<T>): T[] {
  return filterValuesUsingSet(values, set, false);
}

/**
 * Returns values from the first array that are not present in the iterable.
 *
 * @param valuesToExclude - The array of values to filter.
 * @param iterable - The iterable of values to exclude.
 * @returns An array of values not found in the iterable.
 */
export function excludeValues<T>(valuesToExclude: T[], iterable: Maybe<Iterable<T>>): T[] {
  return excludeValuesFromSet(valuesToExclude, new Set(iterable));
}

/**
 * Filters the array to exclude any values present in the given set.
 *
 * @param values - The array to filter.
 * @param set - The set of values to exclude.
 * @returns An array of values not in the set.
 */
export function excludeValuesFromSet<T>(values: T[], set: Set<T>): T[] {
  return filterValuesUsingSet(values, set, true);
}

/**
 * Filters the array using set membership, either including or excluding matched values.
 *
 * @param values - The array to filter.
 * @param set - The set to check against.
 * @param exclude - If true, excludes values in the set; if false, keeps only values in the set.
 * @returns The filtered array.
 */
export function filterValuesUsingSet<T>(values: T[], set: Set<T>, exclude = false): T[] {
  const filterFn = setHasValueFunction(set, exclude);
  return values.filter(filterFn);
}

/**
 * Filters the input iterable using a {@link DecisionFunction} and returns a Set of values for which the function returns true.
 *
 * @param values - The iterable to filter.
 * @param fn - The decision function that determines inclusion.
 * @returns A Set of values that passed the filter.
 */
export function filterValuesToSet<T>(values: Iterable<T>, fn: DecisionFunction<T>): Set<T> {
  const keep = new Set<T>();

  for (const value of values) {
    if (fn(value)) {
      keep.add(value);
    }
  }

  return keep;
}

/**
 * Result of {@link separateValuesToSets} containing included and excluded value sets.
 */
export interface SeparateValuesToSetsResult<T> {
  readonly included: Set<T>;
  readonly excluded: Set<T>;
}

/**
 * Optional sets input that allows specifying specific sets to add the included/excluded values to.
 */
export type SeparateValuesToSetsInput<T> = Partial<SeparateValuesToSetsResult<T>>;

/**
 * Separates values from an iterable into two sets based on a {@link DecisionFunction}.
 * Values for which the function returns true go into `included`, others into `excluded`.
 *
 * @param values - The iterable to partition.
 * @param fn - The decision function that determines inclusion.
 * @param input - Optional pre-existing sets to add results to.
 * @returns An object with `included` and `excluded` sets.
 */
export function separateValuesToSets<T>(values: Iterable<T>, fn: DecisionFunction<T>, input?: SeparateValuesToSetsInput<T>): SeparateValuesToSetsResult<T> {
  const included = input?.included ?? new Set<T>();
  const excluded = input?.excluded ?? new Set<T>();

  for (const value of values) {
    (fn(value) ? included : excluded).add(value);
  }

  return {
    included,
    excluded
  };
}

/**
 * Maps each value in the iterable through a function and collects the results into a Set.
 *
 * @param values - The iterable to map.
 * @param mapFn - The mapping function.
 * @returns A Set of mapped values.
 */
export function mapValuesToSet<I, O>(values: Iterable<I>, mapFn: MapFunction<I, O>): Set<O> {
  const set = new Set<O>();

  for (const value of values) {
    set.add(mapFn(value));
  }

  return set;
}

/**
 * Creates a {@link SetHasValueFunction} from an {@link IterableOrValue} by first converting it to a Set.
 *
 * @param iterable - The values to create a set from.
 * @param exclude - If true, the returned function returns true for values NOT in the set.
 * @returns A function that tests membership.
 */
export function hasValueFunction<T>(iterable: IterableOrValue<T>, exclude: boolean = false): SetHasValueFunction<T> {
  const set = asSet(iterable);
  return setHasValueFunction(set, exclude);
}

/**
 * Returns true if the set has the value. Alternatively, this function can be configured to work in exclusion mode, and may return the opposite.
 */
export type SetHasValueFunction<T> = (value: T) => boolean;

/**
 * Creates a {@link SetHasValueFunction} for the given set. When `exclude` is true, returns the inverse (true for values not in the set).
 *
 * @param set - The set to check against.
 * @param exclude - If true, returns true for values NOT in the set.
 * @returns A function that tests membership.
 */
export function setHasValueFunction<T>(set: Set<T>, exclude: boolean): SetHasValueFunction<T> {
  let hasValueFunction: SetHasValueFunction<T>;

  if (exclude) {
    hasValueFunction = (x) => !set.has(x);
  } else {
    hasValueFunction = (x) => set.has(x);
  }

  return hasValueFunction;
}

/**
 * Configuration for {@link findValuesFrom} that filters an array by key membership.
 */
export interface FindValuesFromInput<T, K extends PrimativeKey = PrimativeKey> {
  /**
   * Values to filter on.
   */
  readonly values: T[];
  /**
   * Keys to find.
   */
  readonly keysToFind?: IterableOrValue<K>;
  /**
   * Values with the same key to match on.
   */
  readonly valuesToFind?: T[];
  /**
   * Reads the key to filter.
   */
  readonly readKey: ReadKeyFunction<T, K>;
  /**
   * Whether or not to exclude found values.
   *
   * For values that do not have keys, this will be used as the result. I.E. if exclude is true, and a value has no key, it will be returned in the results.
   */
  readonly exclude?: boolean;
}

/**
 * Filters an array of values based on whether their keys are found in a specified set of keys or values.
 * Supports both inclusion and exclusion modes.
 *
 * @param config - Configuration specifying the values, keys to find, and filtering behavior.
 * @returns The filtered array of matching values.
 */
export function findValuesFrom<T, K extends PrimativeKey = PrimativeKey>(config: FindValuesFromInput<T, K>): T[] {
  const { readKey, values, exclude = false } = config;

  let set: Set<K>;

  if (config.keysToFind != null) {
    set = asSet(config.keysToFind);
  } else if (config.valuesToFind != null) {
    set = readKeysSetFrom<T, K>(readKey, config.valuesToFind);
  } else {
    set = new Set();
  }

  const filterFn = setHasValueFunction(set, exclude);
  return values.filter((x) => {
    const key = readKey(x);
    return key != null ? filterFn(key) : exclude;
  });
}

/**
 * Contextual decision function that checks whether or not the input values are included.
 */
export type SetIncludesFunction<T> = (valuesToFind: IterableOrValue<T>) => boolean;

/**
 * Creates a {@link SetIncludesFunction} that checks whether the set includes given values using the specified mode.
 *
 * @param valuesSet - The reference set.
 * @param mode - Whether to require 'all' values or 'any' value to be present. Defaults to 'all'.
 * @param emptyValuesToFindArrayResult - The result when the values to find are empty.
 * @returns A function that tests inclusion against the set.
 */
export function setIncludesFunction<T>(valuesSet: Set<T>, mode: SetIncludesMode = 'all', emptyValuesToFindArrayResult?: boolean): SetIncludesFunction<T> {
  let fn: (set: Set<T>, values: IterableOrValue<T>, emptyValuesToFindArrayResult?: boolean) => boolean;

  if (mode === 'any') {
    fn = setContainsAnyValue;
  } else {
    fn = setContainsAllValues;
  }

  return (valuesToFind) => fn(valuesSet, valuesToFind, emptyValuesToFindArrayResult);
}

/**
 * Checks whether the set includes the given values using the specified mode.
 * Convenience wrapper around {@link setIncludesFunction}.
 *
 * @param valuesSet - The reference set.
 * @param valuesToFind - The values to check for.
 * @param mode - Whether to require 'all' or 'any'. Defaults to 'all'.
 * @returns `true` if the inclusion check passes.
 */
export function setIncludes<T>(valuesSet: Set<T>, valuesToFind: IterableOrValue<T>, mode?: SetIncludesMode): boolean {
  return setIncludesFunction(valuesSet, mode)(valuesToFind);
}

/**
 * Returns false if the input array contains any value from the second array.
 */
export function containsNoneOfValue<T>(values: IterableOrValue<T>, valuesToFind: IterableOrValue<T>, emptyValuesToFindArrayResult?: boolean): boolean {
  const set = new Set(asIterable(valuesToFind, false));
  return containsNoValueFromSet(values, set, emptyValuesToFindArrayResult);
}

/**
 * Returns true if none of the values are present in the given set.
 *
 * @param values - The values to check.
 * @param valuesToFind - The set to check against.
 * @param emptyValuesArrayResult - Result when values is empty.
 * @returns `true` if no values are in the set.
 */
export function containsNoValueFromSet<T>(values: IterableOrValue<T>, valuesToFind: Set<T>, emptyValuesArrayResult?: boolean): boolean {
  return setContainsNoneOfValue(valuesToFind, values, emptyValuesArrayResult);
}

/**
 * Returns true if the set contains none of the given values.
 *
 * @param valuesSet - The set to check against.
 * @param valuesToFind - The values to look for.
 * @param emptyValuesToFindArrayResult - Result when valuesToFind is empty. Defaults to true.
 * @returns `true` if none of the values are in the set.
 */
export function setContainsNoneOfValue<T>(valuesSet: Set<T>, valuesToFind: IterableOrValue<T>, emptyValuesToFindArrayResult = true): boolean {
  return !setContainsAnyValue(valuesSet, valuesToFind, emptyValuesToFindArrayResult);
}

/**
 * Returns true if the input array contains any value from the second array.
 *
 * If valuesToFind is empty, returns the emptyValuesToFindArrayResult value. Defaults to false.
 */
export function containsAnyValue<T>(values: IterableOrValue<T>, valuesToFind: IterableOrValue<T>, emptyValuesToFindArrayResult?: boolean): boolean {
  const set = new Set(asIterable(values, false));
  return setContainsAnyValue(set, valuesToFind, emptyValuesToFindArrayResult);
}

/**
 * Returns true if one or more of the input values are contained within the input set.
 *
 * If values is empty, returns the emptyValuesToFindArrayResult value. Defaults to false.
 *
 * @param values
 * @param valuesToFind
 * @returns
 */
export function containsAnyValueFromSet<T>(values: IterableOrValue<T>, valuesToFind: Set<T>, emptyValuesArrayResult?: boolean): boolean {
  return setContainsAnyValue(valuesToFind, values, emptyValuesArrayResult);
}

/**
 * Returns true if the input set contains any values from valuesToFind.
 *
 * If valuesToFind is empty, returns the emptyValuesToFindArrayResult value. Defaults to false.
 *
 * @param valuesSet
 * @param valuesToFind
 * @param emptyValuesToFindArrayResult
 * @returns
 */
export function setContainsAnyValue<T>(valuesSet: Set<T>, valuesToFind: IterableOrValue<T>, emptyValuesToFindArrayResult = false): boolean {
  let result: boolean;

  if (valuesSet) {
    const valuesToFindArray = iterableToArray(valuesToFind);

    if (valuesToFindArray.length > 0) {
      result = valuesToFindArray.findIndex((x) => valuesSet.has(x)) !== -1;
    } else {
      result = emptyValuesToFindArrayResult;
    }
  } else {
    result = false;
  }

  return result;
}

/**
 * Returns true if values contains all values in valuesToFind.
 *
 * If valuesToFind is empty, returns the emptyValuesToFindArrayResult value. Defaults to true.
 *
 * @param values
 * @param valuesToFind
 * @returns
 */
export function containsAllValues<T>(values: Iterable<T>, valuesToFind: IterableOrValue<T>, emptyValuesArrayResult?: boolean): boolean {
  const set = new Set(values);
  return setContainsAllValues(set, valuesToFind, emptyValuesArrayResult);
}

/**
 * Returns true if the input set contains all values from valuesToFind.
 *
 * If valuesToFind is empty, returns the emptyValuesToFindArrayResult value. Defaults to true.
 *
 * @param valuesSet
 * @param valuesToFind
 * @param emptyValuesToFindArrayResult
 * @returns
 */
export function setContainsAllValues<T>(valuesSet: Set<T>, valuesToFind: IterableOrValue<T>, emptyValuesToFindArrayResult = true): boolean {
  let result: boolean;

  if (valuesSet) {
    const valuesToFindArray = iterableToArray(valuesToFind);

    if (valuesToFindArray.length > 0) {
      result = valuesToFindArray.findIndex((x) => !valuesSet.has(x)) == -1;
    } else {
      result = emptyValuesToFindArrayResult;
    }
  } else {
    result = false;
  }

  return result;
}

/**
 * Returns true if both iterables are defined (or are both null/undefined) and have the same values exactly.
 *
 * @param a
 * @param b
 * @returns
 */
export function iterablesAreSetEquivalent<T>(a: Maybe<Iterable<T>>, b: Maybe<Iterable<T>>): boolean {
  return a && b ? setsAreEquivalent(new Set(a), new Set(b)) : a == b;
}

/**
 * Returns true if both sets are defined (or are both null/undefined) and have the same values exactly.
 *
 * @param a
 * @param b
 */
export function setsAreEquivalent<T>(a: Maybe<Set<T>>, b: Maybe<Set<T>>): boolean {
  return a && b ? a.size === b.size && setContainsAllValues(a, b, true) : a == b;
}
