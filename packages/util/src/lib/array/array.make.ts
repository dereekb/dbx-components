import { FactoryWithInput } from '../getter';
import { randomNumberFactory, RandomNumberFactoryInput, RandomNumberFactory } from '../number/random';
import { arrayFactory } from './array.factory';

// MARK: Make Array
export interface MakeArray<T> {
  count: number;
  /**
   * Makes an item
   */
  make: FactoryWithInput<T, number>;
}

// MARK: Make Random Array
export interface RandomArrayFactoryConfig<T> extends Omit<MakeArray<T>, 'count'> {
  random: RandomNumberFactory | RandomNumberFactoryInput;
}

/**
 * Creates an array of a random size and values.
 */
export type RandomArrayFactory<T> = FactoryWithInput<T[], number>;

/**
 * Makes a function that generates arrays of a random length of a specific type.
 *
 * @param config
 * @returns
 */
export function randomArrayFactory<T>(config: RandomArrayFactoryConfig<T>): RandomArrayFactory<T> {
  const randomFn = typeof config.random === 'function' ? config.random : randomNumberFactory(config.random);
  const nextRandomCount = () => Math.abs(randomFn());
  const factory = arrayFactory(config.make);
  return (count = nextRandomCount()) => factory(count);
}
