import { Factory } from './../getter/getter';

export type RandomNumberFactory = Factory<number>;

export interface RandomNumberFactoryConfig {
  min?: number;
  max: number;
}

export type RandomNumberFactoryInput = number | RandomNumberFactoryConfig;

/**
 * Used to generate a RandomNumberFunction that returns a number between the input and the maximum.
 *
 * @param maxOrArgs
 * @returns
 */
export function randomNumberFactory(maxOrArgs: RandomNumberFactoryInput): RandomNumberFactory {
  const config: RandomNumberFactoryConfig = typeof maxOrArgs === 'number' ? { min: 0, max: maxOrArgs } : maxOrArgs;
  const { min, max } = config;
  let fn: RandomNumberFactory;

  if (min != null) {
    const range = max - min;
    fn = () => Math.random() * range + min;
  } else {
    fn = () => Math.random() * max;
  }

  return fn;
}

/**
 * @deprecated use randomNumberFactory() instead.
 */
export const makeRandomFunction = randomNumberFactory;
