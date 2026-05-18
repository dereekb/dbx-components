import { excludeValuesFromSet, keepValuesFromSet } from '../set/set';

// MARK: Functions
/**
 * Returns items that exist in both arrays (intersection).
 *
 * @param values - Source whose entries are kept only when present in the second array.
 * @param secondArray - Allowed-values gate used for the intersection check.
 * @returns Intersection of `values` and `secondArray`, ordered like `values`.
 *
 * @dbxUtil
 * @dbxUtilCategory array
 * @dbxUtilTags array, set, intersection, intersect, keep, common, both
 * @dbxUtilRelated exclude-values-from-array
 */
export function keepValuesFromArray<T>(values: T[], secondArray: T[]): T[] {
  return keepValuesFromSet(values, new Set<T>(secondArray));
}

/**
 * Returns items from the first array that do not exist in the second array (difference).
 *
 * @param values - Source whose entries are kept only when absent from the second array.
 * @param secondArray - Excluded-values gate used for the difference check.
 * @returns Set difference `values \ secondArray`, ordered like `values`.
 *
 * @dbxUtil
 * @dbxUtilCategory array
 * @dbxUtilTags array, set, difference, exclude, subtract, diff
 * @dbxUtilRelated keep-values-from-array
 */
export function excludeValuesFromArray<T>(values: T[], secondArray: T[]): T[] {
  return excludeValuesFromSet(values, new Set<T>(secondArray));
}

/**
 * Checks whether the given array contains any duplicate values.
 *
 * @param values - Source to scan for any repeated entry.
 * @returns True when at least one value appears more than once; otherwise false.
 *
 * @dbxUtil
 * @dbxUtilCategory array
 * @dbxUtilTags array, duplicate, check, validation, set
 * @dbxUtilRelated find-index-of-first-duplicate-value, unique
 */
export function arrayContainsDuplicateValue<T>(values: T[]): boolean {
  return findIndexOfFirstDuplicateValue(values) !== -1;
}

/**
 * Finds the index of the first duplicate value in the given array.
 *
 * @param values - Source to scan left-to-right for the first repeat.
 * @returns Index of the first value that matches an earlier one, or `-1` when all values are unique.
 *
 * @dbxUtil
 * @dbxUtilCategory array
 * @dbxUtilTags array, duplicate, find, index, search
 * @dbxUtilRelated array-contains-duplicate-value, unique
 */
export function findIndexOfFirstDuplicateValue<T>(values: T[]): number {
  const encountered = new Set();
  return values.findIndex((x) => {
    const isDuplicate = encountered.has(x);
    if (!isDuplicate) {
      encountered.add(x);
    }
    return isDuplicate;
  });
}
