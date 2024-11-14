import { removeModelsWithKey, removeModelsWithSameKey, type ReadModelKeyFunction } from '../model/model';
import { type Maybe } from '../value/maybe.type';

export type BooleanStringKey = string;

/**
 * Boolean represented by an array to describe the current state and reason why.
 */
export type BooleanStringKeyArray = BooleanKeyArray<BooleanStringKey>;

/**
 * Boolean represented by an array to describe the current state and reason why.
 *
 * Having any values in the array is considered "true".
 */
export type BooleanKeyArray<T = string> = Maybe<T[]>;

export function readBooleanKeySafetyWrap<T>(readKey: ReadModelKeyFunction<T>): ReadModelKeyFunction<T> {
  return (value: T) => {
    const key = readKey(value);

    if (key === '') {
      throw new Error('Cannot use "empty" string for BooleanKey.');
    } else {
      return key;
    }
  };
}

export function isFalseBooleanKeyArray(value: BooleanKeyArray): boolean {
  return !value || value.length <= 0;
}

export function isTrueBooleanKeyArray(value: BooleanKeyArray): boolean {
  return !isFalseBooleanKeyArray(value);
}

export function insertIntoBooleanKeyArray<T>(array: BooleanKeyArray<T>, value: T, readKey: ReadModelKeyFunction<T>): BooleanKeyArray<T> {
  return array ? [...removeModelsWithSameKey(array, value, readBooleanKeySafetyWrap(readKey)), value] : [value];
}

export function removeFromBooleanKeyArray<T>(array: BooleanKeyArray<T>, value: T, readKey: ReadModelKeyFunction<T>): BooleanKeyArray<T> {
  return array ? removeModelsWithSameKey(array, value, readBooleanKeySafetyWrap(readKey)) : array;
}

export function removeByKeyFromBooleanKeyArray<T>(array: BooleanKeyArray<T>, key: string, readKey: ReadModelKeyFunction<T>): BooleanKeyArray<T> {
  return array ? removeModelsWithKey(array, key, readBooleanKeySafetyWrap(readKey)) : array;
}

export type BooleanKeyArrayUtility<T> = ReturnType<typeof booleanKeyArrayUtility<T>>;

export function booleanKeyArrayUtility<T>(readKey: ReadModelKeyFunction<T>) {
  const isFalse = (value: BooleanKeyArray): boolean => {
    return isFalseBooleanKeyArray(value);
  };

  const isTrue = (value: BooleanKeyArray): boolean => {
    return isTrueBooleanKeyArray(value);
  };

  const set = (array: BooleanKeyArray<T>, value: T, enable: boolean = true): BooleanKeyArray<T> => {
    return enable ? insert(array, value) : remove(array, value);
  };

  const insert = (array: BooleanKeyArray<T>, value: T): BooleanKeyArray<T> => {
    return insertIntoBooleanKeyArray(array, value, readKey);
  };

  const remove = (array: BooleanKeyArray<T>, value: T): BooleanKeyArray<T> => {
    return removeFromBooleanKeyArray(array, value, readKey);
  };

  const removeByKey = (array: BooleanKeyArray<T>, key: string): BooleanKeyArray<T> => {
    return removeByKeyFromBooleanKeyArray(array, key, readKey);
  };

  return {
    isFalse,
    isTrue,
    set,
    insert,
    remove,
    removeByKey
  };
}

export const BooleanStringKeyArrayUtility = booleanKeyArrayUtility<BooleanStringKey>((x) => (x ? x : undefined));

// MARK: Compat
/**
 * @Deprecated use BooleanStringKeyArrayUtility instead
 */
export const BooleanStringKeyArrayUtilityInstance = BooleanStringKeyArrayUtility;
