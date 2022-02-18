import { range } from '@dereekb/util';

// MARK: Number/Math
/**
 * Rounds the input number to the given precision.
 * 
 * @param value 
 * @param precision 
 * @returns 
 */
export function roundToPrecision(value: number, precision: number): number {
  return +(Math.round(Number(value + 'e+' + precision)) + 'e-' + precision);
}

/**
 * Rounds the number up to a specific "step" that contains it.
 * 
 * For example, with the value of 2, and a step size of 5, the value will be rounded up to 1.
 * 
 * @param value Input value.
 * @param step Step size.
 * @returns Step that contains the value.
 */
export function roundNumberUpToStep(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}


export type RandomNumberFunction = () => number;
export interface MakeRandomFunction {
  min?: number;
  max: number;
}

/**
 * Used to generate a RandomNumberFunction that returns a number between the input and the maximum.
 * 
 * @param maxOrArgs 
 * @returns 
 */
export function makeRandomFunction(maxOrArgs: number | MakeRandomFunction): RandomNumberFunction {
  const config: MakeRandomFunction = (typeof maxOrArgs === 'number') ? { min: 0, max: maxOrArgs } : maxOrArgs;
  const { min, max } = config;

  if (min != null) {
    const range = max - min;
    return () => (Math.random() * range) + min;
  } else {
    return () => Math.random() * max;
  }
}
