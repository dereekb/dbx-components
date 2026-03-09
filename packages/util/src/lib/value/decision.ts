import { invertBooleanReturnFunction } from '../function/function.boolean';
import { type FactoryWithRequiredInput } from '../getter/getter';
import { type MapFunction, type AsyncMapFunction } from './map';
import { type Maybe } from './maybe.type';

/**
 * A map function that derives a boolean decision from the input value.
 */
export type DecisionFunction<I> = MapFunction<I, boolean>;

/**
 * Async variant of {@link DecisionFunction}.
 */
export type AsyncDecisionFunction<I> = AsyncMapFunction<DecisionFunction<I>>;

/**
 * Factory that creates a {@link DecisionFunction} from a configuration value.
 */
export type DecisionFunctionFactory<C, I> = FactoryWithRequiredInput<DecisionFunction<I>, C>;

/**
 * Creates a {@link DecisionFunction} that always returns the given boolean, regardless of input.
 *
 * Useful for providing a constant decision where a function is expected.
 *
 * @param decision - the constant boolean value to return
 *
 * @example
 * ```ts
 * const alwaysTrue = decisionFunction(true);
 * alwaysTrue('anything'); // true
 * ```
 */
export function decisionFunction<I>(decision: boolean): DecisionFunction<I> {
  return () => decision;
}

/**
 * Inverts a decision function so it returns the opposite boolean value.
 *
 * When `invert` is false or omitted, the original function is returned unchanged.
 *
 * @param fn - the decision function to potentially invert
 * @param invert - whether to apply the inversion
 *
 * @example
 * ```ts
 * const isPositive: DecisionFunction<number> = (x) => x > 0;
 * const isNotPositive = invertDecision(isPositive, true);
 * isNotPositive(5); // false
 * ```
 */
export const invertDecision: <F extends DecisionFunction<any>>(fn: F, invert?: boolean) => F = invertBooleanReturnFunction;

/**
 * Normalizes a boolean value, a {@link DecisionFunction}, or undefined into a consistent {@link DecisionFunction}.
 *
 * If the input is undefined, falls back to a constant function returning `defaultIfUndefined`.
 *
 * @param valueOrFunction - a boolean, decision function, or undefined
 * @param defaultIfUndefined - fallback boolean when the input is nullish (defaults to true)
 *
 * @example
 * ```ts
 * const fn = asDecisionFunction(true);
 * fn('anything'); // true
 *
 * const fn2 = asDecisionFunction(undefined, false);
 * fn2('anything'); // false
 * ```
 */
export function asDecisionFunction<T = unknown>(valueOrFunction: Maybe<boolean | DecisionFunction<T>>, defaultIfUndefined = true): DecisionFunction<T> {
  const input = valueOrFunction ?? defaultIfUndefined;

  if (typeof input === 'boolean') {
    return decisionFunction(input);
  } else {
    return input;
  }
}

/**
 * Creates a {@link DecisionFunction} that checks strict equality against the given value.
 *
 * If the input is already a function, it is returned as-is, allowing callers to pass either a
 * concrete value or a custom decision function interchangeably.
 *
 * @param equalityValue - the value to compare against, or an existing decision function
 *
 * @example
 * ```ts
 * const isThree = isEqualToValueDecisionFunction(3);
 * isThree(3); // true
 * isThree(4); // false
 * ```
 */
export function isEqualToValueDecisionFunction<T>(equalityValue: T | DecisionFunction<T>): T extends DecisionFunction<T> ? T : DecisionFunction<T>;
export function isEqualToValueDecisionFunction<T>(equalityValue: T | DecisionFunction<T>): DecisionFunction<T> {
  let equalityValueCheckFunction: DecisionFunction<T>;

  if (typeof equalityValue === 'function') {
    equalityValueCheckFunction = equalityValue as DecisionFunction<T>;
  } else {
    equalityValueCheckFunction = (x) => equalityValue === x;
  }

  return equalityValueCheckFunction;
}
