import { excludeValuesFromSet, keepValuesFromSet } from '../set/set';

// MARK: Functions
/**
 * Returns items that exist in both arrays (intersection).
 *
 * @param values - The source array to filter.
 * @param secondArray - The array of values to keep.
 * @returns A new array containing only the values from `values` that also exist in `secondArray`.
 */
export function keepValuesFromArray<T>(values: T[], secondArray: T[]): T[] {
  return keepValuesFromSet(values, new Set<T>(secondArray));
}

/**
 * Returns items from the first array that do not exist in the second array (difference).
 *
 * @param values - The source array to filter.
 * @param secondArray - The array of values to exclude.
 * @returns A new array containing only the values from `values` that do not exist in `secondArray`.
 */
export function excludeValuesFromArray<T>(values: T[], secondArray: T[]): T[] {
  return excludeValuesFromSet(values, new Set<T>(secondArray));
}

/**
 * Checks whether the given array contains any duplicate values.
 *
 * @param values - The array to check for duplicates.
 * @returns `true` if the array contains at least one duplicate value, `false` otherwise.
 */
export function arrayContainsDuplicateValue<T>(values: T[]): boolean {
  return findIndexOfFirstDuplicateValue(values) !== -1;
}

/**
 * Finds the index of the first duplicate value in the given array.
 *
 * @param values - The array to search for duplicates.
 * @returns The index of the first value that is a duplicate of an earlier value, or `-1` if no duplicates exist.
 */
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
