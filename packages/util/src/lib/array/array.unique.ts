import { concatArrays, flattenArray, mergeArrays } from './array';
import { type PrimativeKey, type ReadKeyFunction } from '../key';
import { type Maybe } from '../value/maybe.type';
import { filterMaybeValues } from './array.value';
import { addToSet, removeFromSet } from '../set/set';
import { MAP_IDENTITY } from '../value/map';
import { type Building } from '../value/build';
import { type DecisionFunction } from '../value/decision';

export function concatArraysUnique<T extends PrimativeKey = PrimativeKey>(...arrays: Maybe<T[]>[]): T[] {
  return unique(concatArrays(...arrays));
}

export function flattenArrayUnique<T extends PrimativeKey = PrimativeKey>(array: T[][]): T[] {
  return unique(flattenArray(array));
}

/**
 * Filters the input values and only returns unique values.
 *
 * @param values
 * @param exclude
 * @returns
 */
export function unique<T extends PrimativeKey = PrimativeKey>(values: T[], excludeInput?: FilterUniqueFunctionExcludeKeysInput<T, T>): T[] {
  const unique = new Set(values);
  const exclude = readKeysFromFilterUniqueFunctionAdditionalKeysInput<T>(excludeInput, (x) => x) as T[];

  if (exclude != null && exclude.length) {
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

export type FilterUniqueFunctionAdditionalKeysInput<T, K extends PrimativeKey = PrimativeKey> = K[] | FilterUniqueFunctionAdditionalKeys<T, K>;
export type FilterUniqueFunctionExcludeKeysInput<T, K extends PrimativeKey = PrimativeKey> = T[] | FilterUniqueFunctionAdditionalKeys<T, K>;

export interface FilterUniqueFunctionAdditionalKeys<T, K extends PrimativeKey = PrimativeKey> {
  readonly keys?: Maybe<K[]>;
  readonly values?: Maybe<T[]>;
}

export function readKeysFromFilterUniqueFunctionAdditionalKeysInput<T, K extends PrimativeKey = PrimativeKey>(additionalKeysInput: Maybe<FilterUniqueFunctionAdditionalKeysInput<T, K>>, readKey: ReadKeyFunction<T, K>): K[] {
  return filterMaybeValues(additionalKeysInput != null ? (Array.isArray(additionalKeysInput) ? additionalKeysInput : readKeysFromFilterUniqueFunctionAdditionalKeys<T, K>(additionalKeysInput, readKey)) : []);
}

export function readKeysFromFilterUniqueFunctionAdditionalKeys<T, K extends PrimativeKey = PrimativeKey>(input: FilterUniqueFunctionAdditionalKeys<T, K>, readKey: ReadKeyFunction<T, K>): Maybe<K>[] {
  const keys = new Set<Maybe<K>>(input.keys);

  if (input.values) {
    addToSet(keys, input.values.map(readKey));
  }

  return Array.from(keys);
}

/**
 * Creates a FilterUniqueFunction.
 *
 * @param readKey
 * @param additionalKeys
 * @returns
 */
export function filterUniqueFunction<T, K extends PrimativeKey = PrimativeKey>(readKey: ReadKeyFunction<T, K>, additionalKeysInput?: FilterUniqueFunctionAdditionalKeysInput<T, K>): FilterUniqueFunction<T, K> {
  const baseKeys: K[] = readKeysFromFilterUniqueFunctionAdditionalKeysInput(additionalKeysInput, readKey);

  function calculateExclude(excludeInput?: FilterUniqueFunctionExcludeKeysInput<T, K>): K[] {
    const newExcludeKeys = excludeInput ? (Array.isArray(excludeInput) ? excludeInput.map(readKey) : readKeysFromFilterUniqueFunctionAdditionalKeys(excludeInput, readKey)) : [];
    return newExcludeKeys?.length ? mergeArrays([filterMaybeValues(newExcludeKeys), baseKeys]) : baseKeys;
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

export function filterUniqueValues<T, K extends PrimativeKey = PrimativeKey>(values: T[], readKey: ReadKeyFunction<T, K>, additionalKeys: K[] = []): T[] {
  return filterUniqueFunction(readKey, additionalKeys)(values);
}

/**
 * Returns true if all input values have unique keys.
 */
export type IsUniqueKeyedFunction<T> = DecisionFunction<T[]>;

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
 * Creates a new AllowValueOnceFilter.
 */
export function allowValueOnceFilter<T extends PrimativeKey = PrimativeKey>(): AllowValueOnceFilter<T, T>;
export function allowValueOnceFilter<T, K extends PrimativeKey = PrimativeKey>(readKey?: ReadKeyFunction<T, K>): AllowValueOnceFilter<T, K>;
export function allowValueOnceFilter<T, K extends PrimativeKey = PrimativeKey>(inputReadKey?: ReadKeyFunction<T, K>): AllowValueOnceFilter<T, K> {
  const visitedKeys = new Set<Maybe<K>>();
  const readKey = inputReadKey || (MAP_IDENTITY as ReadKeyFunction<T, K>);

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
