import { OperatorFunction, identity, MonoTypeOperatorFunction, map } from "rxjs";
import { onMatchDelta } from "./delta";

/**
 * Returns the pipe if usePipe is true, otherwise returns the identity.
 */
export function pipeIf<A>(usePipe: boolean, pipe: OperatorFunction<A, A>): OperatorFunction<A, A> {
  return (usePipe) ? pipe : identity;
}

/**
 * Maps the opposite value of the input boolean.
 */
export function isNot(): MonoTypeOperatorFunction<boolean> {
  return map(x => !x);
}

/**
 * Emits a value when moving from a true value to a false value.
 */
export function onTrueToFalse(): MonoTypeOperatorFunction<boolean> {
  return onMatchDelta({
    from: true,
    to: false,
    requireConsecutive: true
  });
}

/**
 * Emits a value when moving from a false value to a true value.
 */
export function onFalseToTrue(): MonoTypeOperatorFunction<boolean> {
  return onMatchDelta({
    from: false,
    to: true,
    requireConsecutive: true
  });
}
