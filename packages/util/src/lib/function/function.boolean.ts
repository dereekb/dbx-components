/**
 * A function that returns a boolean.
 */
export type BooleanReturnFunction = (...args: any[]) => boolean;

/**
 * Inverts the output of an arbitrary boolean-returning function.
 *
 * @dbxUtil
 * @dbxUtilCategory function
 * @dbxUtilKind factory
 * @dbxUtilTags function, boolean, invert, predicate, factory
 * @dbxUtilRelated decision-function, filter-function
 *
 * @param decisionFn - The function whose boolean return value to invert
 * @param invert - Whether to apply the inversion (defaults to true)
 * @returns The inverted function, or the original if invert is false
 * @__NO_SIDE_EFFECTS__
 */
export function invertBooleanReturnFunction<F extends BooleanReturnFunction>(decisionFn: F, invert = true): F {
  return invert
    ? (((...args: any[]) => {
        const result: boolean = (decisionFn as any).call(undefined, ...args);
        return !result;
      }) as F)
    : decisionFn;
}
