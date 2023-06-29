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
  const randomIndex = randomNumberFactory({ min: 0, max: values.length, round: 'floor' });
  return () => values[randomIndex()];
}
