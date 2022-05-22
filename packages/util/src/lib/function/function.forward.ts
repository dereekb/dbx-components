import { Getter } from "../getter/getter";


export type ForwardFunction<I extends (...args: unknown[]) => O, O = unknown> = I;

/**
 * Wraps a Getter that returns a function. When the function is invoked, the getter retrieves the function then calls it with the input arguments.
 * 
 * @param getter 
 * @returns 
 */
export function forwardFunction<I extends (...args: unknown[]) => O, O = unknown>(getter: Getter<I>): ForwardFunction<I> {
  const fn = ((...args: unknown[]) => {
    const forwardFn = getter();
    return forwardFn(...args);
  }) as ForwardFunction<I, O>;

  return fn;
}
