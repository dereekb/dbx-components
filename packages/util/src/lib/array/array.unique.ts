import { concatArrays, flattenArray, mergeArrays } from './array';
import { type PrimativeKey, type ReadKeyFunction } from '../key';
import { type Maybe } from '../value/maybe.type';
import { filterMaybeArrayValues } from './array.value';
import { addToSet, removeFromSet } from '../set/set';
import { MAP_IDENTITY } from '../value/map';
import { type Building } from '../value/build';
import { type DecisionFunction } from '../value/decision';

/**
 * Concatenates multiple arrays and returns only unique values.
 *
 * @param arrays - Arrays to concatenate. Null/undefined arrays are ignored.
 * @returns Array containing only unique values from all input arrays.
 */
export function concatArraysUnique<T extends PrimativeKey = PrimativeKey>(...arrays: Maybe<T[]>[]): T[] {
  return unique(concatArrays(...arrays));
}

/**
 * Flattens a 2D array and returns only unique values.
 *
 * @param array - Two-dimensional array to flatten and deduplicate.
 * @returns Array containing only unique values from the flattened input.
 */
export function flattenArrayUnique<T extends PrimativeKey = PrimativeKey>(array: T[][]): T[] {
  return unique(flattenArray(array));
}

/**
 * Filters the input values and only returns unique values.
 *
 * @param values - Array of primitive-key values to deduplicate.
 * @param excludeInput - Optional keys or values to exclude from the result.
 * @returns Array containing only unique values with exclusions removed.
 */
export function unique<T extends PrimativeKey = PrimativeKey>(values: T[], excludeInput?: FilterUniqueFunctionExcludeKeysInput<T, T>): T[] {
  const unique = new Set(values);
  const exclude = readKeysFromFilterUniqueFunctionAdditionalKeysInput<T>(excludeInput, (x) => x) as T[];

  if (exclude.length) {
    removeFromSet(unique, exclude);
  }

  return Array.from(unique);
}

/**
 * Finds unique values in the input.
 *
 * Can also specify additional values to exclude.
 */
export type FilterUniqueFunction<T, K extends PrimativeKey = PrimativeKey> = (input: T[], exclude?: FilterUniqueFunctionExcludeKeysInput<T, K>) => T[];

/**
 * Input for specifying additional keys to include in uniqueness checks. Accepts either a raw array of keys or a {@link FilterUniqueFunctionAdditionalKeys} object.
 */
export type FilterUniqueFunctionAdditionalKeysInput<T, K extends PrimativeKey = PrimativeKey> = K[] | FilterUniqueFunctionAdditionalKeys<T, K>;

/**
 * Input for specifying keys or values to exclude from unique filtering. Accepts either a raw array of values or a {@link FilterUniqueFunctionAdditionalKeys} object.
 */
export type FilterUniqueFunctionExcludeKeysInput<T, K extends PrimativeKey = PrimativeKey> = T[] | FilterUniqueFunctionAdditionalKeys<T, K>;

/**
 * Provides additional keys and/or values to seed the uniqueness filter, causing those entries to be treated as already seen.
 */
export interface FilterUniqueFunctionAdditionalKeys<T, K extends PrimativeKey = PrimativeKey> {
  readonly keys?: Maybe<K[]>;
  readonly values?: Maybe<T[]>;
}

/**
 * Reads and resolves keys from a {@link FilterUniqueFunctionAdditionalKeysInput}, handling both raw key arrays and structured input objects.
 *
 * @param additionalKeysInput - Input containing keys to resolve.
 * @param readKey - Function to extract a key from a value.
 * @returns Flat array of resolved non-null keys.
 */
export function readKeysFromFilterUniqueFunctionAdditionalKeysInput<T, K extends PrimativeKey = PrimativeKey>(additionalKeysInput: Maybe<FilterUniqueFunctionAdditionalKeysInput<T, K>>, readKey: ReadKeyFunction<T, K>): K[] {
  return filterMaybeArrayValues(additionalKeysInput != null ? (Array.isArray(additionalKeysInput) ? additionalKeysInput : readKeysFromFilterUniqueFunctionAdditionalKeys<T, K>(additionalKeysInput, readKey)) : []);
}

/**
 * Reads keys from a {@link FilterUniqueFunctionAdditionalKeys} object by combining explicit keys with keys derived from values.
 *
 * @param input - Object containing explicit keys and/or values to derive keys from.
 * @param readKey - Function to extract a key from a value.
 * @returns Array of keys, which may include null/undefined entries.
 */
export function readKeysFromFilterUniqueFunctionAdditionalKeys<T, K extends PrimativeKey = PrimativeKey>(input: FilterUniqueFunctionAdditionalKeys<T, K>, readKey: ReadKeyFunction<T, K>): Maybe<K>[] {
  const keys = new Set<Maybe<K>>(input.keys);

  if (input.values) {
    addToSet(keys, input.values.map(readKey));
  }

  return Array.from(keys);
}

/**
 * Creates a {@link FilterUniqueFunction} that deduplicates items by their computed key.
 *
 * @param readKey - Function to extract a unique key from each item.
 * @param additionalKeysInput - Optional keys or values to pre-seed as already seen, causing them to be excluded.
 * @returns A reusable filter function that removes duplicate items from arrays.
 */
export function filterUniqueFunction<T, K extends PrimativeKey = PrimativeKey>(readKey: ReadKeyFunction<T, K>, additionalKeysInput?: FilterUniqueFunctionAdditionalKeysInput<T, K>): FilterUniqueFunction<T, K> {
  const baseKeys: K[] = readKeysFromFilterUniqueFunctionAdditionalKeysInput(additionalKeysInput, readKey);

  function calculateExclude(excludeInput?: FilterUniqueFunctionExcludeKeysInput<T, K>): K[] {
    const newExcludeKeys = excludeInput ? (Array.isArray(excludeInput) ? excludeInput.map(readKey) : readKeysFromFilterUniqueFunctionAdditionalKeys(excludeInput, readKey)) : [];
    return newExcludeKeys.length ? mergeArrays([filterMaybeArrayValues(newExcludeKeys), baseKeys]) : baseKeys;
  }

  return (input: T[], excludeInput?: FilterUniqueFunctionExcludeKeysInput<T, K>) => {
    const exclude = calculateExclude(excludeInput);
    const keys = new Set<Maybe<K>>(exclude);

    const result: T[] = input.filter((x) => {
      const key: Maybe<K> = readKey(x);

      if (!keys.has(key)) {
        keys.add(key);
        return true;
      }

      return false;
    });

    return result;
  };
}

/**
 * Filters an array to contain only items with unique keys.
 *
 * @param values - Array of items to deduplicate.
 * @param readKey - Function to extract a unique key from each item.
 * @param additionalKeys - Optional keys to pre-seed as already seen, excluding matching items.
 * @returns Array containing only the first occurrence of each uniquely-keyed item.
 */
export function filterUniqueValues<T, K extends PrimativeKey = PrimativeKey>(values: T[], readKey: ReadKeyFunction<T, K>, additionalKeys: K[] = []): T[] {
  return filterUniqueFunction(readKey, additionalKeys)(values);
}

/**
 * Returns true if all input values have unique keys.
 */
export type IsUniqueKeyedFunction<T> = DecisionFunction<T[]>;

/**
 * Creates an {@link IsUniqueKeyedFunction} that checks whether all items in an array have unique keys.
 *
 * @param readKey - Function to extract a unique key from each item.
 * @returns A decision function that returns true if all items have distinct keys.
 */
export function isUniqueKeyedFunction<T, K extends PrimativeKey = PrimativeKey>(readKey: ReadKeyFunction<T, K>): IsUniqueKeyedFunction<T> {
  return (input) => {
    const keys = new Set<Maybe<K>>();

    const findResult = input.findIndex((x) => {
      const key = readKey(x);
      let hasDuplicate = false;

      if (key != null) {
        if (keys.has(key)) {
          hasDuplicate = true;
        } else {
          keys.add(key);
        }
      }

      return hasDuplicate;
    });

    return findResult === -1;
  };
}

// MARK: Factory
/**
 * Function that returns true for a value the first time that value's key is visited. Will return false for all visits after that.
 */
export type AllowValueOnceFilter<T, K extends PrimativeKey = PrimativeKey> = DecisionFunction<T> & {
  /**
   * ReadKey function
   */
  readonly _readKey: ReadKeyFunction<T, K>;
  /**
   * Set of all visited keys used to return false if a key is visited again.
   */
  readonly _visitedKeys: Set<Maybe<K>>;
};

/**
 * Creates a new {@link AllowValueOnceFilter} that permits each unique key only on its first encounter.
 *
 * @param inputReadKey - Optional function to extract a key from each value. Defaults to identity.
 * @returns A stateful filter function that returns true only for the first occurrence of each key.
 */
export function allowValueOnceFilter<T extends PrimativeKey = PrimativeKey>(): AllowValueOnceFilter<T, T>;
export function allowValueOnceFilter<T, K extends PrimativeKey = PrimativeKey>(readKey?: ReadKeyFunction<T, K>): AllowValueOnceFilter<T, K>;
export function allowValueOnceFilter<T, K extends PrimativeKey = PrimativeKey>(inputReadKey?: ReadKeyFunction<T, K>): AllowValueOnceFilter<T, K> {
  const visitedKeys = new Set<Maybe<K>>();
  const readKey = inputReadKey ?? (MAP_IDENTITY as ReadKeyFunction<T, K>);

  const fn = ((x: T) => {
    const key: Maybe<K> = readKey(x);

    if (!visitedKeys.has(key)) {
      visitedKeys.add(key);
      return true;
    }

    return false;
  }) as Building<AllowValueOnceFilter<T, K>>;

  fn._readKey = readKey;
  fn._visitedKeys = visitedKeys;

  return fn as AllowValueOnceFilter<T, K>;
}
