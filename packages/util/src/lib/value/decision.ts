import { FilterFunction, invertFilter } from '../filter/filter';
import { FactoryWithRequiredInput } from '../getter/getter';
import { MapFunction, AsyncMapFunction } from './map';
import { Maybe } from './maybe.type';

/**
 * A map function that derives a boolean from the input.
 */
export type DecisionFunction<I> = MapFunction<I, boolean>;
export type AsyncDecisionFunction<I> = AsyncMapFunction<DecisionFunction<I>>;

export type DecisionFunctionFactory<C, I> = FactoryWithRequiredInput<DecisionFunction<I>, C>;

/**
 * Used to invert a decision function by returning the opposite of what it returns.
 *
 * @param filterFn
 * @param invert whether or not to apply the inversion.
 * @returns
 */
export function invertDecision<T = unknown, F extends DecisionFunction<T> = DecisionFunction<T>>(decisionFn: F, invert = true): F {
  return invertFilter(decisionFn as FilterFunction, invert) as F;
}

/**
 * Creates a DecisionFunction from the input.
 *
 * @param valueOrFunction
 * @param defaultIfUndefined
 * @returns
 */
export function asDecisionFunction<T = unknown>(valueOrFunction: Maybe<boolean | DecisionFunction<T>>, defaultIfUndefined = true): DecisionFunction<T> {
  const input = valueOrFunction ?? defaultIfUndefined;

  if (typeof input === 'boolean') {
    return () => input;
  } else {
    return input;
  }
}
