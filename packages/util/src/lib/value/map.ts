import { PromiseOrValue } from '../promise/promise';
import { build } from './build';
import { Maybe } from './maybe.type';

/**
 * Converts one value to another.
 */
export type MapFunction<I, O> = (input: I) => O;

/**
 * Converts a MapFunction into one that returns a promise.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AsyncMapFunction<F extends MapFunction<any, any>> = F extends MapFunction<infer I, infer O> ? MapFunction<I, PromiseOrValue<O>> : never;

/**
 * Converts a MapFunction into one that takes in arrays and returns arrays.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MapArrayFunction<F extends MapFunction<any, any>> = F extends MapFunction<infer I, infer O> ? MapFunction<I[], O[]> : never;

/**
 * Converts values from the input, and applies them to the target if a target is supplied.
 */
export type ApplyMapFunction<I, O> = (input: I, target?: Maybe<Partial<O>>) => O;

/**
 * Converts values from the input, and applies them to the target if a target is supplied.
 */
export type ApplyMapFunctionWithOptions<I, O, C> = (input: I, target?: Maybe<Partial<O>>, options?: Maybe<C>) => O;

export function mapArrayFunction<I, O>(mapFunction: MapFunction<I, O>): MapArrayFunction<MapFunction<I, O>> {
  return (input: I[]) => input.map(mapFunction);
}

export const MAP_IDENTITY = (input: unknown) => input;

export function mapIdentityFunction<T>(): MapFunction<T, T> {
  return MAP_IDENTITY as MapFunction<T, T>;
}

// MARK: Pair
export type MapFunctionOutputPair<O, I = unknown> = {
  input: I;
  output: O;
};

/**
 * Wraps a MapFunction to instead provide the input and output values.
 *
 * @param fn
 * @returns
 */
export function mapFunctionOutputPair<O, I = unknown>(fn: MapFunction<I, O>): MapFunction<I, MapFunctionOutputPair<O, I>> {
  return (input: I) => {
    const output = fn(input);

    return {
      input,
      output
    };
  };
}

// MARK: Output
/**
 * MapFunction output value that captures the input it was derived from.
 */
export type MapFunctionOutput<O extends object, I = unknown> = O & { readonly _input: I };

/**
 *
 * @param fn
 * @returns
 */
export function wrapMapFunctionOutput<O extends object, I = unknown>(fn: MapFunction<I, O>): MapFunction<I, MapFunctionOutput<O, I>> {
  return (input: I) => {
    const result = fn(input);
    return mapFunctionOutput(result, input);
  };
}

export function mapFunctionOutput<O extends object, I = unknown>(output: O, input: I): MapFunctionOutput<O, I> {
  return build<MapFunctionOutput<O, I>>({
    base: output,
    build: (x) => {
      x._input = input as MapFunctionOutput<O, I>['_input'];
    }
  });
}
