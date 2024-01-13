import { type Building } from '../value/build';
import { type DecisionFunction } from './../value/decision';

/**
 * DecisionFunction that checks whether or not the input is in the set, or the input's value is in the set.
 */
export type IsInSetDecisionFunction<T, V> = DecisionFunction<T> & {
  readonly _readValue: (input: T) => V;
  readonly _set: Set<V>;
};

/**
 * Creates an IsInSetDecisionFunction.
 *
 * @param set
 */
export function isInSetDecisionFunction<T>(set: Set<T>): IsInSetDecisionFunction<T, T>;
export function isInSetDecisionFunction<T, V>(set: Set<V>, readValue: (value: T) => V): IsInSetDecisionFunction<T, V>;
export function isInSetDecisionFunction<T, V>(set: Set<V>, inputReadValue?: (value: T) => V): IsInSetDecisionFunction<T, V> {
  const readValue = inputReadValue ?? ((x) => x as unknown as V);

  const fn = ((x: T) => {
    const v = readValue(x);
    return set.has(v);
  }) as Building<IsInSetDecisionFunction<T, V>>;

  fn._readValue = readValue;
  fn._set = set;

  return fn as IsInSetDecisionFunction<T, V>;
}
