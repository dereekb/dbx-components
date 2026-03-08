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
 * @param object - The object mapping keys to values
 * @param keys - The keys to intersect with the object
 * @returns An array of values from the matching keys
 */
export function mapKeysIntersectionObjectToArray<T>(object: MapKeysIntersectionObject<T>, keys: Iterable<string>): T[] {
  const keysToApply = Array.from(keys);
  const applyArray: T[] = [];

  keysToApply.forEach((key: string) => {
    const values = object[key];

    if (values != null) {
      pushItemOrArrayItemsIntoArray(applyArray, values);
    }
  });

  return applyArray;
}
