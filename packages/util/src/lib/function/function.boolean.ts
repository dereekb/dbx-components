/**
 * A function that returns a boolean.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BooleanReturnFunction = (...args: any[]) => boolean;

/**
 * Inverts the output of an arbitrary boolean-returning function.
 *
 * @param decisionFn - The function whose boolean return value to invert
 * @param invert - Whether to apply the inversion (defaults to true)
 * @returns The inverted function, or the original if invert is false
 */
export function invertBooleanReturnFunction<F extends BooleanReturnFunction>(decisionFn: F, invert = true): F {
  if (invert) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((...args: any[]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: boolean = (decisionFn as any).call(undefined, ...args);
      return !result;
    }) as F;
  } else {
    return decisionFn;
  }
}
