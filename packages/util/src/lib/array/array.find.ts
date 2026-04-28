import { invertBooleanReturnFunction } from '../function/function.boolean';
import { type SetIncludesMode } from '../set/set.mode';

/**
 * Predicate function that tests an individual array element, similar to the callback used by {@link Array.prototype.find} or {@link Array.prototype.filter}.
 */
export type ArrayFindDecisionFunction<T> = (value: T, index: number, obj: T[]) => boolean;

/**
 * Preconfigured function that evaluates an array and returns whether its elements satisfy a decision criterion based on a {@link SetIncludesMode}.
 */
export type ArrayDecisionFunction<T> = (values: T[]) => boolean;

/**
 * Creates an {@link ArrayDecisionFunction} from a per-element predicate and a {@link SetIncludesMode}.
 *
 * When mode is `'any'`, the resulting function returns `true` if at least one element satisfies the predicate.
 * When mode is `'all'`, it returns `true` only if every element satisfies the predicate.
 *
 * @param decision - Predicate used to test individual elements.
 * @param mode - Whether all or any elements must satisfy the predicate.
 * @returns A function that evaluates an array against the configured decision criteria.
 */
export function arrayDecisionFunction<T>(decision: ArrayFindDecisionFunction<T>, mode: SetIncludesMode): ArrayDecisionFunction<T> {
  const findFn: ArrayFindDecisionFunction<T> = mode === 'all' ? invertBooleanReturnFunction(decision) : decision;
  return invertBooleanReturnFunction((values) => values.some((v, i, arr) => findFn(v, i, arr)), mode === 'all');
}

/**
 * Convenience wrapper that creates and immediately invokes an {@link ArrayDecisionFunction}.
 *
 * @param values - Array to evaluate.
 * @param decision - Predicate used to test individual elements.
 * @param mode - Whether all or any elements must satisfy the predicate.
 * @returns `true` if the array satisfies the decision criteria for the given mode.
 */
export function arrayDecision<T>(values: T[], decision: ArrayFindDecisionFunction<T>, mode: SetIncludesMode): boolean {
  return arrayDecisionFunction(decision, mode)(values);
}
