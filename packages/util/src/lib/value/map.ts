import { asArray, type ArrayOrValue } from '../array/array';
import { filterMaybeValues } from '../array/array.value';
import { type PromiseOrValue } from '../promise/promise.type';
import { build } from './build';
import { isMaybeNot } from './maybe';
import { type Maybe, type MaybeNot } from './maybe.type';

/**
 * Converts one value to another.
 */
export type MapFunction<I, O> = (input: I) => O;

/**
 * Function that reads a value from the input.
 *
 * Equivalent to a MapFunction.
 */
export type ReadValueFunction<I, O> = MapFunction<I, O>;

/**
 * Turns a normal MapFunction into one that passes through Maybe values without attempting to map them.
 *
 * @param mapFunction
 * @returns
 */
export function mapMaybeFunction<I, O>(mapFunction: MapFunction<I, O>): MapFunction<Maybe<I>, Maybe<O>> {
  return (input: Maybe<I>) => {
    const output: Maybe<O> = isMaybeNot(input) ? input : mapFunction(input);
    return output;
  };
}

/**
 * MapFunction with the same input as output.
 */
export type MapSameFunction<I> = MapFunction<I, I>;

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

export const MAP_IDENTITY: <T>(input: T) => T = ((input: unknown) => input) as <T>(input: T) => T;

export function mapIdentityFunction<T>(): MapFunction<T, T> {
  return MAP_IDENTITY as MapFunction<T, T>;
}

export function isMapIdentityFunction(fn: unknown): fn is typeof MAP_IDENTITY {
  return fn === MAP_IDENTITY;
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

// MARK: Chaining
/**
 * Chains together multiple MapSameFunctions in the same order. Functions that are not defined are ignored.
 *
 * @param fns
 */
export function chainMapSameFunctions<I>(input: ArrayOrValue<Maybe<MapSameFunction<I>>>): MapSameFunction<I> {
  const fns = filterMaybeValues(asArray(input).filter((x) => !isMapIdentityFunction(x))); // remove all identify functions too
  let fn: MapSameFunction<I>;

  switch (fns.length) {
    case 0:
      fn = mapIdentityFunction();
      break;
    case 1:
      fn = fns[0];
      break;
    default:
      fn = fns[0];

      for (let i = 1; i < fns.length; i += 1) {
        fn = chainMapFunction(fn, fns[i]);
      }
      break;
  }

  return fn;
}

/**
 * Creates a single function that chains the two map functions together, if apply is true or undefined.
 *
 * If apply is false, or the second map function is not defined, returns the first map function.
 *
 * @param a
 * @param b
 */
export function chainMapFunction<I>(a: MapSameFunction<I>, b: Maybe<MapSameFunction<I>>): MapSameFunction<I>;
export function chainMapFunction<I>(a: MapSameFunction<I>, b: Maybe<MapSameFunction<I>>, apply?: boolean): MapSameFunction<I>;
export function chainMapFunction<I, O, B>(a: MapFunction<I, O>, b: MapFunction<O, B>): MapFunction<I, B>;
export function chainMapFunction<I, O, B>(a: MapFunction<I, O>, b: MaybeNot): MapFunction<I, O>;
export function chainMapFunction<I, O, B>(a: MapFunction<I, O>, b: Maybe<MapFunction<O, B>>, apply: false): MapFunction<I, O>;
export function chainMapFunction<I, O, B>(a: MapFunction<I, O>, b: MaybeNot, apply: true): MapFunction<I, O>;
export function chainMapFunction<I, O, B>(a: MapFunction<I, O>, b: MapFunction<O, B>, apply: true): MapFunction<I, B>;
export function chainMapFunction<I, O, B>(a: MapFunction<I, O>, b: Maybe<MapFunction<O, B>>, apply: boolean): MapFunction<I, O> | MapFunction<I, B>;
export function chainMapFunction<I, O, B>(a: MapFunction<I, O>, b: Maybe<MapFunction<O, B>>, apply = true): MapFunction<I, O> | MapFunction<I, B> {
  if (apply && b != null) {
    return (x) => b(a(x));
  } else {
    return a;
  }
}
