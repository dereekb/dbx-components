import { Maybe } from '../value/maybe.type';
import { flattenArray } from '../array/array';
import { asIterable, IterableOrValue, iterableToArray, useIterableOrValue } from '../iterable/iterable';
import { symmetricDifference } from 'extra-set';
import { PrimativeKey, ReadKeyFunction, readKeysSetFrom } from '../key';
import { SetIncludesMode } from './set.mode';
import { DecisionFunction } from '../value/decision';
import { MapFunction } from '../value/map';

export type AllOrNoneSelection = 'all' | 'none';

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

export function toggleInSetCopy<T>(set: Set<T>, values: Maybe<IterableOrValue<T>>): Set<T> {
  return copySetAndDo(set, (x) => toggleInSet(x, values));
}

export function toggleInSet<T>(set: Set<T>, values: Maybe<IterableOrValue<T>>) {
  useIterableOrValue(values, (x) => {
    if (set.has(x)) {
      set.delete(x);
    } else {
      set.add(x);
    }
  });
}

export function removeFromSetCopy<T>(set: Set<T>, values: Maybe<IterableOrValue<T>>): Set<T> {
  return copySetAndDo(set, (x) => removeFromSet(x, values));
}

export function removeFromSet<T>(set: Set<T>, values: Maybe<IterableOrValue<T>>) {
  useIterableOrValue(values, (x) => set.delete(x));
}

export function hasSameValues<T>(a: Maybe<Iterable<T>>, b: Maybe<Iterable<T>>): boolean {
  return !hasDifferentValues(a, b);
}

export function hasDifferentValues<T>(a: Maybe<Iterable<T>>, b: Maybe<Iterable<T>>): boolean {
  const setA = new Set(a);
  return a == null || b == null || !setContainsAllValues(setA, b) || setA.size !== new Set(b).size;
}

export function symmetricDifferenceArray<T>(a: Maybe<Iterable<T>>, b: Maybe<Iterable<T>>): Maybe<T>[] {
  return symmetricDifferenceArrayBetweenSets(new Set(a), new Set(b));
}

export function symmetricDifferenceArrayBetweenSets<T>(a: Set<Maybe<T>>, b: Set<Maybe<T>>): Maybe<T>[] {
  return Array.from(symmetricDifference(a, b));
}

export function flattenArrayToSet<T>(array: T[][]): Set<T> {
  return new Set(flattenArray(array));
}

/**
 * If the input values to keep is null or undefined, returns an empty set.
 *
 * @param set
 * @param values
 * @returns
 */
export function keepFromSetCopy<T>(set: Set<T>, values: Maybe<IterableOrValue<T>>): Set<T> {
  return values != null ? filterValuesToSet(asIterable(values), (x) => set.has(x)) : new Set();
}

export function keepValuesFromSet<T>(values: T[], set: Set<T>): T[] {
  return filterValuesUsingSet(values, set, false);
}

export function excludeValues<T>(valuesToExclude: T[], iterable: Maybe<Iterable<T>>): T[] {
  return excludeValuesFromSet(valuesToExclude, new Set(iterable));
}

/**
 * Excludes any values in the input array using the set.
 *
 * @param values
 * @param set
 * @returns
 */
export function excludeValuesFromSet<T>(values: T[], set: Set<T>): T[] {
  return filterValuesUsingSet(values, set, true);
}

/**
 * Filters the values from the array using
 *
 * @param values
 * @param set
 * @param exclude
 * @returns
 */
export function filterValuesUsingSet<T>(values: T[], set: Set<T>, exclude = false): T[] {
  const filterFn = setHasValueFunction(set, exclude);
  return values.filter(filterFn);
}

/**
 * Filters the input iterable using a DecisionFunction and returns a Set.
 *
 * @param values
 * @param fn
 * @returns
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
 * SeparateValuesToSets() result
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
 * Filters the input iterable using a DecisionFunction and returns a Set.
 *
 * @param values
 * @param fn
 * @returns
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
 * Maps the input iterable using a MapFunction and returns a Set of the mapped values.
 *
 * @param values
 * @param fn
 * @returns
 */
export function mapValuesToSet<I, O>(values: Iterable<I>, mapFn: MapFunction<I, O>): Set<O> {
  const set = new Set<O>();

  for (const value of values) {
    set.add(mapFn(value));
  }

  return set;
}

/**
 * Convenience function for using setHasValueFunction with IterableOrValue input.
 *
 * @param iterable
 * @param exclude
 * @returns
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
 * Creates a SetHasValueFunction. May create a function that returns the inverse.
 *
 * @param set
 * @param exclude
 * @returns
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
 * Finds values from the set based on the input.
 *
 * @param config
 * @returns
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
 * Creates a SetIncludesFunction using the input valuesSet and optional mode. By default the mode defaults to 'all'.
 *
 * @param valuesSet
 * @param valuesToFind
 * @param mode
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
 * Returns false if the input array contains any value from the second array.
 */
export function containsNoneOfValue<T>(values: IterableOrValue<T>, valuesToFind: IterableOrValue<T>, emptyValuesToFindArrayResult?: boolean): boolean {
  const set = new Set(asIterable(valuesToFind, false));
  return containsNoValueFromSet(values, set, emptyValuesToFindArrayResult);
}

export function containsNoValueFromSet<T>(values: IterableOrValue<T>, valuesToFind: Set<T>, emptyValuesArrayResult?: boolean): boolean {
  return setContainsNoneOfValue(valuesToFind, values, emptyValuesArrayResult);
}

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

// TODO: Continue checking all values

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

// MARK: Compat
/**
 * @deprecated use symmetricDifferenceArray
 */
export const symmetricDifferenceKeys = symmetricDifferenceArray;

/**
 * @deprecated use symmetricDifferenceArrayBetweenSets
 */
export const symmetricDifferenceKeysSet = symmetricDifferenceArrayBetweenSets;

/**
 * @deprecated use filterValuesUsingSet
 */
export const filterValuesFromSet = filterValuesUsingSet;
