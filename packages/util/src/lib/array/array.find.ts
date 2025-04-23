import { invertBooleanReturnFunction } from '../function/function.boolean';
import { type SetIncludesMode } from '../set/set.mode';

/**
 * A decision function used by the array find function.
 * Similar to the predicate function in Array.prototype.find() or Array.prototype.filter().
 * @template T - The type of elements in the array
 */
export type ArrayFindDecisionFunction<T> = (value: T, index: number, obj: T[]) => boolean;

/**
 * Returns a decision about an array based on its input values using a preconfigured DecisionFunction and SetIncludesMode.
 *
 * @template T - The type of elements in the array
 */
export type ArrayDecisionFunction<T> = (values: T[]) => boolean;

/**
 * Creates an ArrayDecisionFunction based on the input decision and mode.
 *
 * @template T - The type of elements in the array
 * @param decision - The function used to test individual elements of the array
 * @param mode - The mode determining how the decision is applied ('any' or 'all')
 * @returns A function that takes an array and returns a boolean decision based on the array elements
 */
export function arrayDecisionFunction<T>(decision: ArrayFindDecisionFunction<T>, mode: SetIncludesMode): ArrayDecisionFunction<T> {
  const findFn: ArrayFindDecisionFunction<T> = mode === 'all' ? invertBooleanReturnFunction(decision) : decision;
  return invertBooleanReturnFunction((values) => values.findIndex(findFn) !== -1, mode === 'all');
}

/**
 * Returns true based on the input values and find decision.
 * A convenience function that creates and immediately applies an array decision function.
 *
 * @template T - The type of elements in the array
 * @param values - The array to evaluate
 * @param decision - The function used to test individual elements of the array
 * @param mode - The mode determining how the decision is applied ('any' or 'all')
 * @returns A boolean indicating whether the array meets the decision criteria
 */
export function arrayDecision<T>(values: T[], decision: ArrayFindDecisionFunction<T>, mode: SetIncludesMode): boolean {
  return arrayDecisionFunction(decision, mode)(values);
}
