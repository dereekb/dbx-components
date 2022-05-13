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

export function arrayContainsDuplicateValue<T>(values: T[]): boolean {
  return findIndexOfFirstDuplicateValue(values) !== -1;
}

export function findIndexOfFirstDuplicateValue<T>(values: T[]): number {
  const encountered = new Set();
  return values.findIndex((x) => {
    if (encountered.has(x)) {
      return true;
    } else {
      encountered.add(x);
      return false;
    }
  });
}
