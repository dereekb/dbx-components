import { Configurable } from '../type';
import { IndexNumber } from '../value/index';

/**
 * Returns a random value from the pre-configured values array.
 */
export type RandomPickFactory<T> = (() => T) & {
  /**
   * Array of all pickable values within this factory.
   */
  readonly _values: T[];
};

/**
 * Creates a RandomPickFactory<T> from the input values.
 *
 * @param values
 * @returns
 */
export function randomPickFactory<T>(values: T[]): RandomPickFactory<T> {
  if (values.length === 0) {
    throw new Error('randomPickFactory() cannot use an empty array.');
  }

  const fn = (() => {
    const index = randomArrayIndex(values);
    return values[index];
  }) as RandomPickFactory<T>;
  (fn as Configurable<RandomPickFactory<T>>)._values = values;
  return fn;
}

/**
 * Returns a random index from the input values.
 *
 * @param values
 * @returns
 */
export function randomArrayIndex<T>(values: T[]): IndexNumber {
  if (values.length === 0) {
    return 0;
  } else {
    const random = Math.random();
    const index = Math.round(random * (values.length - 1));
    return index;
  }
}

/**
 * Picks an item randomly from the input array. If the array is empty, returns undefined.
 *
 * @param values
 */
export function pickOneRandomly<T>(values: T[]): T {
  return randomPickFactory(values)();
}
