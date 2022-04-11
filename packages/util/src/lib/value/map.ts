import { Maybe } from "./maybe";

/**
 * Converts one value to another.
 */
export type MapFunction<I, O> = (input: I) => O;

/**
 * Converts values from the input, and applies them to the target if a target is supplied.
 */
export type ApplyMapFunction<I, O> = (input: I, target?: Maybe<Partial<O>>) => O;

/**
 * Converts values from the input, and applies them to the target if a target is supplied.
 */
export type ApplyMapFunctionWithOptions<I, O, C> = (input: I, target?: Maybe<Partial<O>>, config?: C) => O;
