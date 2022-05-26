import { removeModelsWithKey, removeModelsWithSameKey, ReadModelKeyFunction } from '../model/model';
import { Maybe } from '../value/maybe';

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

export class BooleanKeyArrayUtilityInstance<T> {
  constructor(readonly readKey: ReadModelKeyFunction<T>) {}

  isFalse(value: BooleanKeyArray): boolean {
    return isFalseBooleanKeyArray(value);
  }

  isTrue(value: BooleanKeyArray): boolean {
    return isTrueBooleanKeyArray(value);
  }

  set(array: BooleanKeyArray<T>, value: T, enable = true): BooleanKeyArray<T> {
    let result: BooleanKeyArray<T>;

    if (enable) {
      result = this.insert(array, value);
    } else {
      result = this.remove(array, value);
    }

    return result;
  }

  insert(array: BooleanKeyArray<T>, value: T): BooleanKeyArray<T> {
    return insertIntoBooleanKeyArray(array, value, this.readKey);
  }

  remove(array: BooleanKeyArray<T>, value: T): BooleanKeyArray<T> {
    return removeFromBooleanKeyArray(array, value, this.readKey);
  }

  removeByKey(array: BooleanKeyArray<T>, key: string): BooleanKeyArray<T> {
    return removeByKeyFromBooleanKeyArray(array, key, this.readKey);
  }
}

export const BooleanStringKeyArrayUtilityInstance = new BooleanKeyArrayUtilityInstance<BooleanStringKey>((x) => (x ? x : undefined));
