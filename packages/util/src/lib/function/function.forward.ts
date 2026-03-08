/*eslint @typescript-eslint/no-explicit-any:"off"*/
// any is used with intent here. using unknown can have strange effects in usage of forwardFunction and type capture.

import { type Getter } from '../getter/getter';
import { type Maybe } from '../value/maybe.type';

/**
 * A function type that forwards its call to another function retrieved lazily.
 */
export type ForwardFunction<I extends (...args: any[]) => O, O = unknown> = I;

/**
 * Wraps a Getter that returns a function. When the returned function is invoked,
 * it retrieves the target function from the getter and calls it with the provided arguments.
 *
 * Useful for late-binding or circular dependency resolution.
 *
 * @param getter - A Getter that provides the target function
 * @returns A forwarding function with the same signature as the target
 */
export function forwardFunction<I extends (...args: any[]) => O, O = unknown>(getter: Getter<I>): ForwardFunction<I> {
  const fn = ((...args: unknown[]) => {
    const forwardFn = getter();
    return forwardFn(...args);
  }) as ForwardFunction<I, O>;

  return fn;
}

/**
 * Factory that wraps an optional function with a forwarding function, falling back to a default.
 */
export type DefaultForwardFunctionFactory<I extends (...args: any[]) => O, O = unknown> = (fn: Maybe<I>) => ForwardFunction<I, O>;

/**
 * Creates a factory that produces forwarding functions which use the provided function
 * or fall back to the default function when not provided.
 *
 * @param defaultFn - The default function to use as fallback
 * @returns A factory that wraps optional functions with a default fallback
 */
export function defaultForwardFunctionFactory<I extends (...args: any[]) => O, O = unknown>(defaultFn: I): DefaultForwardFunctionFactory<I, O> {
  return (fn: Maybe<I>) => forwardFunction(() => fn ?? defaultFn);
}
