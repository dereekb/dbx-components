import { invertBooleanReturnFunction } from '../function/function.boolean';
import { FactoryWithRequiredInput } from '../getter/getter';
import { Building } from './build';
import { safeEqualityComparatorFunction } from './comparator';
import { MapFunction, AsyncMapFunction, ReadValueFunction } from './map';
import { Maybe } from './maybe.type';

/**
 * A map function that derives a boolean from the input.
 */
export type DecisionFunction<I> = MapFunction<I, boolean>;
export type AsyncDecisionFunction<I> = AsyncMapFunction<DecisionFunction<I>>;

export type DecisionFunctionFactory<C, I> = FactoryWithRequiredInput<DecisionFunction<I>, C>;

export function decisionFunction<I>(decision: boolean): DecisionFunction<I> {
  return () => decision;
}

/**
 * Used to invert a decision function by returning the opposite of what it returns.
 *
 * @param filterFn
 * @param invert whether or not to apply the inversion.
 * @returns
 */
export const invertDecision: <F extends DecisionFunction<any>>(fn: F, invert?: boolean) => F = invertBooleanReturnFunction;

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
