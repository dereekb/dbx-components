import { randomNumberFactory } from '../number/random';
import { Factory } from './getter';

/**
 * Returns a random value.
 */
export type RandomFromArrayFactory<T> = Factory<T>;

/**
 * Makes a RandomFromArrayFactory
 *
 * @param config
 * @returns
 */
export function randomFromArrayFactory<T>(values: T[]): RandomFromArrayFactory<T> {
  const random = randomNumberFactory({ min: 0, max: values.length - 1, round: 'floor' });
  return () => values[random()];
}
