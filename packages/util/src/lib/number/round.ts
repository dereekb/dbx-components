// MARK: Number/Math
/**
 * Rounds the input number to the given precision.
 *
 * @param value
 * @param precision
 * @returns
 */
export function roundToPrecision(value: number, precision: number): number {
  return +(Math.round(Number(value + 'e+' + precision)) + 'e-' + precision);
}

/**
 * Rounds the number up to a specific "step" that contains it.
 *
 * For example, with the value of 2, and a step size of 5, the value will be rounded up to 1.
 *
 * @param value Input value.
 * @param step Step size.
 * @returns Step that contains the value.
 */
export function roundNumberUpToStep(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}
