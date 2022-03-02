import { OperatorFunction, identity } from "rxjs";

/**
 * Returns the pipe if usePipe is true, otherwise returns the identity.
 */
 export function pipeIf<A>(usePipe: boolean, pipe: OperatorFunction<A, A>): OperatorFunction<A, A> {
  return (usePipe) ? pipe : identity;
}
