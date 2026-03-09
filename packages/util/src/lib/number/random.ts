import { type NumberFactory } from './factory';
import { roundingFunction, type RoundingInput } from './round';

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
 * Creates a factory that generates random numbers within a configured range.
 *
 * Accepts either a simple max number or a full config object with min, max, and rounding options.
 *
 * @param maxOrArgs - Maximum value (exclusive) or full configuration object
 * @param roundingInput - Optional rounding mode override
 * @returns A factory function that produces random numbers within the range
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

/**
 * Generates a single random number using {@link randomNumberFactory}. Convenience function for one-off usage.
 *
 * @param maxOrArgs - Maximum value (exclusive) or full configuration object
 * @param roundingInput - Optional rounding mode
 * @returns A single random number
 */
export function randomNumber(maxOrArgs: RandomNumberFactoryInput, roundingInput?: RoundingInput) {
  return randomNumberFactory(maxOrArgs, roundingInput)();
}
