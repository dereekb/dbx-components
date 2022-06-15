import { MapFunction } from '../value/map';
import { Factory } from './../getter/getter';

export type RandomNumberFactory = Factory<number>;

export type NumberRounding = 'none' | 'floor' | 'ceil' | 'round';
export type RoundingFunction = MapFunction<number, number>;

export function roundingFunction(type: NumberRounding): RoundingFunction {
  let fn: RoundingFunction;

  switch (type) {
    case 'floor':
      fn = Math.floor;
      break;
    case 'ceil':
      fn = Math.ceil;
      break;
    case 'none':
      fn = (x) => x;
      break;
    case 'round':
    default:
      fn = Math.round;
      break;
  }

  return fn;
}

export type RoundingInput = NumberRounding | RoundingFunction;

/**
 * randomNumberFactory configuration
 */
export interface RandomNumberFactoryConfig {
  /**
   * Rounding type. By default will round to
   */
  round?: RoundingInput;
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
