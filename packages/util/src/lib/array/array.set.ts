import { excludeValuesFromSet, keepValuesFromSet } from '../set/set';

// MARK: Functions
/**
 * Returns items that exist in both arrays.
 */
export function keepValuesFromArray<T>(values: T[], secondArray: T[]): T[] {
  return keepValuesFromSet(values, new Set<T>(secondArray));
}

export function excludeValuesFromArray<T>(values: T[], secondArray: T[]): T[] {
  return excludeValuesFromSet(values, new Set<T>(secondArray));
}
