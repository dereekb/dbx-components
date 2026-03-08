import { randomNumberFactory } from '../number/random';
import { type Factory } from './getter';

/**
 * Returns a random value.
 */
export type RandomFromArrayFactory<T> = Factory<T>;

/**
 * Creates a factory that returns a random element from the given array on each call.
 *
 * @param values - The array of values to randomly select from
 * @returns A factory that returns a random element from the array
 */
export function randomFromArrayFactory<T>(values: T[]): RandomFromArrayFactory<T> {
  const randomIndex = randomNumberFactory({ min: 0, max: values.length, round: 'floor' });
  return () => values[randomIndex()];
}
