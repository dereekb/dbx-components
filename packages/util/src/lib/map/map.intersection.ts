import { ArrayOrValue, mergeArrayOrValueIntoArray } from '../array/array';

/**
 * Object used as a map of keys that will intersect with input keys.
 */
export interface MapKeysIntersectionObject<T> {
  [key: string]: ArrayOrValue<T>;
}

/**
 * Builds an array from intersection of the input object and input keys that correspond to values that should be part of the result.
 * 
 * @param object 
 * @param keys 
 * @returns 
 */
export function mapKeysIntersectionObjectToArray<T>(object: MapKeysIntersectionObject<T>, keys: Iterable<string>): T[] {
  const keysToApply = Array.from(keys);
  const applyArray: T[] = [];

  keysToApply.forEach((key: string) => {
    const values = object[key];

    if (values != null) {
      mergeArrayOrValueIntoArray(applyArray, values);
    }
  });

  return applyArray;
}
