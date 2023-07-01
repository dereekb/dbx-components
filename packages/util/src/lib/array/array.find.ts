import { invertBooleanReturnFunction } from '../function/function.boolean';
import { SetIncludesMode } from '../set/set.mode';

/**
 * A decision function used by the array find function.
 */
export type ArrayFindDecisionFunction<T> = (value: T, index: number, obj: T[]) => boolean;

/**
 * Returns a decision about an array based on it's input values using a preconfigured DecisionFunction and SetInclduesMode.
 */
export type ArrayDecisionFunction<T> = (values: T[]) => boolean;

/**
 * Creates a ArrayDecisionFunction based on the input decision and mode.
 *
 * @param decision
 * @param mode
 * @returns
 */
export function arrayDecisionFunction<T>(decision: ArrayFindDecisionFunction<T>, mode: SetIncludesMode): ArrayDecisionFunction<T> {
  const findFn: ArrayFindDecisionFunction<T> = mode === 'all' ? invertBooleanReturnFunction(decision) : decision;
  return invertBooleanReturnFunction((values) => values.findIndex(findFn) !== -1, mode === 'all');
}

/**
 * Returns true based on the input values and find decision.
 */
export function arrayDecision<T>(values: T[], decision: ArrayFindDecisionFunction<T>, mode: SetIncludesMode): boolean {
  return arrayDecisionFunction(decision, mode)(values);
}
