import { type ArrayOrValue, pushItemOrArrayItemsIntoArray } from '../array/array';

/**
 * Object used as a map of keys that will intersect with input keys.
 */
export interface MapKeysIntersectionObject<T> {
  [key: string]: ArrayOrValue<T>;
}

/**
 * Builds an array from the intersection of an object's keys with the provided keys.
 * For each matching key, the associated value (or values) are added to the result array.
 *
 * @param object - Lookup whose entries should be activated when their keys are requested.
 * @param keys - Requested key set restricting which entries contribute values.
 * @returns Flattened values drawn from entries whose key was requested.
 */
export function mapKeysIntersectionObjectToArray<T>(object: MapKeysIntersectionObject<T>, keys: Iterable<string>): T[] {
  const keysToApply = [...keys];
  const applyArray: T[] = [];

  keysToApply.forEach((key: string) => {
    const values = object[key];

    if (values != null) {
      pushItemOrArrayItemsIntoArray(applyArray, values);
    }
  });

  return applyArray;
}
