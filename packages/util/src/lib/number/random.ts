import { NumberFactory } from './factory';
import { roundingFunction, RoundingInput } from './round';

/**
 * Factory that generates random numbers.
 */
export type RandomNumberFactory = NumberFactory;

/**
 * randomNumberFactory configuration
 */
export interface RandomNumberFactoryConfig {
  /**
   * Rounding configuration.
   *
   * No rounding by default.
   */
  round?: RoundingInput;
  /**
   * Minimum number (inclusive)
   */
  min?: number;
  /**
   * Max number (exclusive)
   */
  max: number;
}

export type RandomNumberFactoryInput = number | RandomNumberFactoryConfig;

/**
 * Used to generate a RandomNumberFunction that returns a number between the input and the maximum (exclusive).
 *
 * @param maxOrArgs
 * @returns
 */
export function randomNumberFactory(maxOrArgs: RandomNumberFactoryInput, roundingInput?: RoundingInput): RandomNumberFactory {
  const config: RandomNumberFactoryConfig = typeof maxOrArgs === 'number' ? { min: 0, max: maxOrArgs } : maxOrArgs;
  const { min, max, round: roundConfig } = config;
  const round = roundingInput ?? roundConfig;
  let fn: RandomNumberFactory;

  if (min != null) {
    const range = max - min;
    fn = () => Math.random() * range + min;
  } else {
    fn = () => Math.random() * max;
  }

  if (round && round !== 'none') {
    const roundFn = typeof round === 'function' ? round : roundingFunction(round);
    const randomFn = fn;
    fn = () => roundFn(randomFn());
  }

  return fn;
}

export function randomNumber(maxOrArgs: RandomNumberFactoryInput, roundingInput?: RoundingInput) {
  return randomNumberFactory(maxOrArgs, roundingInput)();
}
