import { type Configurable } from '../type';
import { type IndexNumber } from '../value/index';

/**
 * A callable factory that returns a random value from its pre-configured values array on each invocation.
 */
export type RandomPickFactory<T> = (() => T) & {
  /**
   * Array of all pickable values within this factory.
   */
  readonly _values: T[];
};

/**
 * Creates a {@link RandomPickFactory} from the input values.
 *
 * @param values - array of values to randomly pick from
 * @returns a callable factory that returns a random value from the array on each invocation
 * @throws Error if the input array is empty
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
 * Returns a random index from the input array. Returns 0 if the array is empty.
 *
 * @param values - array to generate a random index for
 * @returns a random valid index within the array, or 0 if the array is empty
 */
export function randomArrayIndex<T>(values: T[]): IndexNumber {
  return values.length === 0 ? 0 : Math.round(Math.random() * (values.length - 1));
}

/**
 * Picks a single item randomly from the input array.
 *
 * @param values - array to pick a random item from
 * @returns a randomly selected item from the array
 * @throws Error if the input array is empty
 */
export function pickOneRandomly<T>(values: T[]): T {
  return randomPickFactory(values)();
}
