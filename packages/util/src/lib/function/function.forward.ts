/*eslint @typescript-eslint/no-explicit-any:"off"*/
// any is used with intent here. using unknown can have strange effects in usage of forwardFunction and type capture.

import { Getter } from '../getter/getter';
import { Maybe } from '../value/maybe.type';

export type ForwardFunction<I extends (...args: any[]) => O, O = unknown> = I;

/**
 * Wraps a Getter that returns a function. When the function is invoked, the getter retrieves the function then calls it with the input arguments.
 *
 * @param getter
 * @returns
 */
export function forwardFunction<I extends (...args: any[]) => O, O = unknown>(getter: Getter<I>): ForwardFunction<I> {
  const fn = ((...args: unknown[]) => {
    const forwardFn = getter();
    return forwardFn(...args);
  }) as ForwardFunction<I, O>;

  return fn;
}

export type DefaultForwardFunctionFactory<I extends (...args: any[]) => O, O = unknown> = (fn: Maybe<I>) => ForwardFunction<I, O>;

export function defaultForwardFunctionFactory<I extends (...args: any[]) => O, O = unknown>(defaultFn: I): DefaultForwardFunctionFactory<I, O> {
  return (fn: Maybe<I>) => forwardFunction(() => fn ?? defaultFn);
}
