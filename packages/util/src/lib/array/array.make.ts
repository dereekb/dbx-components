import { type FactoryWithInput } from '../getter';
import { randomNumberFactory, type RandomNumberFactoryInput, type RandomNumberFactory } from '../number/random';
import { arrayFactory } from './array.factory';

// MARK: Make Array
/**
 * Configuration for creating an array of items using a factory function.
 */
export interface MakeArray<T> {
  readonly count: number;
  /**
   * Makes an item
   */
  readonly make: FactoryWithInput<T, number>;
}

// MARK: Make Random Array
/**
 * Configuration for creating a {@link RandomArrayFactory}. Combines a make function with a random number source to produce arrays of varying length.
 */
export interface RandomArrayFactoryConfig<T> extends Omit<MakeArray<T>, 'count'> {
  readonly random: RandomNumberFactory | RandomNumberFactoryInput;
}

/**
 * Creates an array of a random size and values.
 */
export type RandomArrayFactory<T> = FactoryWithInput<T[], number>;

/**
 * Creates a factory function that generates arrays of a random length populated with items from a make function.
 *
 * @param config - configuration containing the make function and random number source
 * @returns a factory that produces arrays of random length, optionally accepting a specific count override
 */
export function randomArrayFactory<T>(config: RandomArrayFactoryConfig<T>): RandomArrayFactory<T> {
  const randomFn = typeof config.random === 'function' ? config.random : randomNumberFactory(config.random);
  const nextRandomCount = () => Math.abs(randomFn());
  const factory = arrayFactory(config.make);
  return (count = nextRandomCount()) => factory(count);
}
