import { type OperatorFunction, identity, type MonoTypeOperatorFunction, map } from 'rxjs';
import { onMatchDelta } from './delta';

/**
 * Conditionally applies an operator. Returns the given pipe when `usePipe` is true, otherwise returns identity (pass-through).
 *
 * @param usePipe - Whether to apply the pipe.
 * @param pipe - The operator to conditionally apply.
 * @returns The pipe or identity operator.
 */
export function pipeIf<A>(usePipe: boolean, pipe: OperatorFunction<A, A>): OperatorFunction<A, A> {
  return usePipe ? pipe : identity;
}

/**
 * RxJS operator that negates each emitted boolean value.
 *
 * @returns Operator that maps each boolean emission to its negated value.
 */
export function isNot(): MonoTypeOperatorFunction<boolean> {
  return map((x) => !x);
}

/**
 * RxJS operator that only emits when a boolean stream transitions from `true` to `false`.
 *
 * @returns Operator that filters to only true-to-false transition emissions.
 */
export function onTrueToFalse(): MonoTypeOperatorFunction<boolean> {
  return onMatchDelta({
    from: true,
    to: false,
    requireConsecutive: true
  });
}

/**
 * RxJS operator that only emits when a boolean stream transitions from `false` to `true`.
 *
 * @returns Operator that filters to only false-to-true transition emissions.
 */
export function onFalseToTrue(): MonoTypeOperatorFunction<boolean> {
  return onMatchDelta({
    from: false,
    to: true,
    requireConsecutive: true
  });
}
