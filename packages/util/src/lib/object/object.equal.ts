import { isEqual } from "lodash";

/**
 * Performs a deep comparison to check if all values on the input filters are equal.
 */
export function areEqualObjectValues<F>(a: F, b: F): boolean {
  return isEqual(a, b);
}
