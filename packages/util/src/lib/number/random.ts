export type RandomNumberFunction = () => number;

export interface MakeRandomFunction {
  min?: number;
  max: number;
}

export type MakeRandomFunctionInput = number | MakeRandomFunction;

/**
 * Used to generate a RandomNumberFunction that returns a number between the input and the maximum.
 * 
 * @param maxOrArgs 
 * @returns 
 */
export function makeRandomFunction(maxOrArgs: MakeRandomFunctionInput): RandomNumberFunction {
  const config: MakeRandomFunction = (typeof maxOrArgs === 'number') ? { min: 0, max: maxOrArgs } : maxOrArgs;
  const { min, max } = config;

  if (min != null) {
    const range = max - min;
    return () => (Math.random() * range) + min;
  } else {
    return () => Math.random() * max;
  }
}
