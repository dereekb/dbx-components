/**
 * A function that returns a boolean.
 */
export type BooleanReturnFunction = (...args: any[]) => boolean;

/**
 * Inverts the output of an arbitrary boolean function.
 *
 * @param decisionFn
 * @param invert
 * @returns
 */
export function invertBooleanReturnFunction<F extends BooleanReturnFunction>(decisionFn: F, invert = true): F {
  if (invert) {
    return ((...args: any[]) => {
      const result: boolean = (decisionFn as any).call(undefined, ...args);
      return !result;
    }) as F;
  } else {
    return decisionFn;
  }
}
