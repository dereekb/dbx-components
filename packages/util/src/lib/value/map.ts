import { asArray, type ArrayOrValue } from '../array/array';
import { filterMaybeArrayValues } from '../array/array.value';
import { type PromiseOrValue } from '../promise/promise.type';
import { build } from './build';
import { isMaybeNot } from './maybe';
import { type Maybe, type MaybeNot } from './maybe.type';

/**
 * Converts a value of one type to another, serving as the fundamental transformation primitive throughout the library.
 */
export type MapFunction<I, O> = (input: I) => O;

/**
 * Function that reads a value from the input.
 *
 * Equivalent to a MapFunction.
 */
export type ReadValueFunction<I, O> = MapFunction<I, O>;

/**
 * Wraps a MapFunction so that null/undefined inputs are passed through without invoking the map,
 * avoiding errors on nullable values.
 *
 * @param mapFunction - function to apply only when the input is defined
 * @returns a new function that short-circuits on null/undefined inputs
 *
 * @example
 * ```ts
 * const double = (x: number) => x * 2;
 * const maybeDouble = mapMaybeFunction(double);
 *
 * maybeDouble(3);         // 6
 * maybeDouble(undefined); // undefined
 * maybeDouble(null);      // null
 * ```
 */
export function mapMaybeFunction<I, O>(mapFunction: MapFunction<I, O>): MapFunction<Maybe<I>, Maybe<O>> {
  return (input: Maybe<I>) => {
    const output: Maybe<O> = isMaybeNot(input) ? input : mapFunction(input);
    return output;
  };
}

/**
 * A MapFunction whose output type matches its input type, useful for in-place transformations or chained pipelines.
 */
export type MapSameFunction<I> = MapFunction<I, I>;

/**
 * Derives an asynchronous variant of a MapFunction, allowing the output to be either a value or a Promise.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AsyncMapFunction<F extends MapFunction<any, any>> = F extends MapFunction<infer I, infer O> ? MapFunction<I, PromiseOrValue<O>> : never;

/**
 * Derives an array variant of a MapFunction that maps each element individually, producing an array of results.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MapArrayFunction<F extends MapFunction<any, any>> = F extends MapFunction<infer I, infer O> ? MapFunction<I[], O[]> : never;

/**
 * Maps values from the input to the output type, optionally merging into an existing partial target object.
 */
export type ApplyMapFunction<I, O> = (input: I, target?: Maybe<Partial<O>>) => O;

/**
 * Maps values from the input to the output type, optionally merging into a partial target and accepting additional options.
 */
export type ApplyMapFunctionWithOptions<I, O, C> = (input: I, target?: Maybe<Partial<O>>, options?: Maybe<C>) => O;

/**
 * Lifts a per-element MapFunction into one that operates on arrays, applying the mapping to each element.
 *
 * @param mapFunction - per-element transformation
 * @returns a function that maps entire arrays
 */
export function mapArrayFunction<I, O>(mapFunction: MapFunction<I, O>): MapArrayFunction<MapFunction<I, O>> {
  return (input: I[]) => input.map(mapFunction);
}

/**
 * The canonical identity MapFunction. Returns its input unchanged.
 *
 * Used as a sentinel value so that {@link chainMapSameFunctions} and other combinators can detect
 * and skip no-op mappings for efficiency.
 */
export const MAP_IDENTITY: <T>(input: T) => T = ((input: unknown) => input) as <T>(input: T) => T;

/**
 * Returns the shared {@link MAP_IDENTITY} function cast to the requested type, useful for providing a typed no-op transformation.
 */
export function mapIdentityFunction<T>(): MapFunction<T, T> {
  return MAP_IDENTITY as MapFunction<T, T>;
}

/**
 * Checks whether the given function is the singleton {@link MAP_IDENTITY} reference.
 */
export function isMapIdentityFunction(fn: unknown): fn is typeof MAP_IDENTITY {
  return fn === MAP_IDENTITY;
}

// MARK: Pair
/**
 * Captures both the input and output of a MapFunction invocation, useful for debugging or auditing transformations.
 */
export type MapFunctionOutputPair<O, I = unknown> = {
  input: I;
  output: O;
};

/**
 * Wraps a MapFunction so that each invocation returns a {@link MapFunctionOutputPair} containing both the original input and the computed output.
 *
 * @param fn - the map function to wrap
 * @returns a new function that returns input/output pairs
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
 * Wraps a MapFunction so that its object output is augmented with a readonly `_input` property referencing the original input.
 * Useful for retaining provenance through a transformation pipeline.
 *
 * @param fn - the map function whose output will be augmented
 * @returns a new function that returns a {@link MapFunctionOutput} with the `_input` reference attached
 */
export function wrapMapFunctionOutput<O extends object, I = unknown>(fn: MapFunction<I, O>): MapFunction<I, MapFunctionOutput<O, I>> {
  return (input: I) => {
    const result = fn(input);
    return mapFunctionOutput(result, input);
  };
}

/**
 * Attaches a readonly `_input` property to the given output object, creating a {@link MapFunctionOutput}.
 *
 * @param output - the computed output object
 * @param input - the original input value to attach
 * @returns the output augmented with `_input`
 */
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
 * Chains together multiple MapSameFunctions into a single pipeline executed left-to-right.
 * Null/undefined entries and identity functions are automatically removed for efficiency.
 * Returns the identity function if no meaningful functions remain.
 *
 * @param input - one or more optional same-type map functions to chain
 * @returns a single composed function that runs all provided functions in order
 *
 * @example
 * ```ts
 * const fnChain = chainMapSameFunctions([
 *   (x: string) => x,
 *   (x: string) => x,
 * ]);
 *
 * const result = fnChain('aaaab');
 * // result === 'aaaab'
 * ```
 */
export function chainMapSameFunctions<I>(input: ArrayOrValue<Maybe<MapSameFunction<I>>>): MapSameFunction<I> {
  const fns = filterMaybeArrayValues(asArray(input).filter((x) => !isMapIdentityFunction(x))); // remove all identify functions too
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
 * Creates a single function that pipes the output of `a` into `b`.
 *
 * If `apply` is false, or `b` is null/undefined, returns `a` unchanged. This conditional chaining
 * is useful when a second transform step is optional.
 *
 * @param a - the first map function
 * @param b - the optional second map function to chain after `a`
 * @param apply - when false, skips chaining and returns `a` directly
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
