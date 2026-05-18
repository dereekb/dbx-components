import { randomNumberFactory } from '../number/random';
import { type Factory } from './getter';

/**
 * Returns a random value.
 */
export type RandomFromArrayFactory<T> = Factory<T>;

/**
 * Creates a factory that returns a random element from the given array on each call.
 *
 * @param values - Candidate pool the factory picks from on each call.
 * @returns Stable producer that yields a uniformly random pick from `values`.
 *
 * @dbxUtil
 * @dbxUtilCategory getter
 * @dbxUtilKind factory
 * @dbxUtilTags getter, factory, random, array, sample
 * @dbxUtilRelated random-number-factory, random-array-factory
 *
 * @__NO_SIDE_EFFECTS__
 */
export function randomFromArrayFactory<T>(values: T[]): RandomFromArrayFactory<T> {
  const randomIndex = randomNumberFactory({ min: 0, max: values.length, round: 'floor' });
  return () => values[randomIndex()];
}
