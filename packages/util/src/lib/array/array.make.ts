import { makeRandomFunction, MakeRandomFunctionInput, RandomNumberFunction } from "../number/random";

export interface MakeArray<T> {
  count: number;
  make: (i: number) => T;
}

/**
 * Makes an array of values of a certain length using a generator function.
 * 
 * @param param0 
 * @returns 
 */
export function makeArray<T>({ count, make }: MakeArray<T>): T[] {
  let array: T[] = [];

  for (let i = 0; i < count; i += 1) {
    array.push(make(i));
  }

  return array;
}

export interface MakeArrayRandom<T> extends Omit<MakeArray<T>, 'count'> {
  random: RandomNumberFunction | MakeRandomFunctionInput;
}

/**
 * Makes a function that generates arrays of a random length of a specific type.
 * 
 * @param config 
 * @returns 
 */
export function makeRandomArrayFn<T>(config: MakeArrayRandom<T>): () => T[] {
  const randomFn = (typeof config.random === 'function') ? config.random : makeRandomFunction(config.random);
  return () => makeArray({ count: Math.abs(randomFn()), make: config.make });
}
