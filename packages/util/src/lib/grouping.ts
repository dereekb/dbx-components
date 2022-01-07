import { FieldOfType, PrimativeKey, ReadKeyFunction } from "./key";
import { mapToObject } from "./object";

export interface SeparateResult<T> {
  included: T[];
  excluded: T[];
}

export interface GroupingResult<T> {
  [key: string]: T[];
}

export type KeyedGroupingResult<T, O, K extends keyof O = keyof O> = {
  [k in K]: T[];
}

/**
 * Separates the input values into an included and excluded group.
 * 
 * @param values 
 * @param checkInclusion 
 * @returns 
 */
export function separateValues<T>(values: T[], checkInclusion: (x: T) => boolean): SeparateResult<T> {
  const result: KeyedGroupingResult<T, { in: any, out: any }> = groupValues(values, (x) => {
    return (checkInclusion(x)) ? 'in' : 'out';
  });

  return {
    included: result.in || [],
    excluded: result.out || []
  };
}

/**
 * Convenience function for makeValuesGroupMap that returns a POJO instead of a Map.
 * 
 * @param values 
 * @param groupKeyFn 
 */
export function groupValues<T, R, K extends PrimativeKey & keyof R>(values: T[], groupKeyFn: ReadKeyFunction<T, K>): KeyedGroupingResult<T, R, K>;
export function groupValues<T, K extends PrimativeKey = PrimativeKey>(values: T[], groupKeyFn: ReadKeyFunction<T, K>): GroupingResult<T>;
export function groupValues<T, K extends PrimativeKey = PrimativeKey>(values: T[], groupKeyFn: ReadKeyFunction<T, K>): GroupingResult<T> {
  const map = makeValuesGroupMap<T, K>(values, groupKeyFn);
  return mapToObject(map);
}

/**
 * Reads keys from the values in the arrays, and groups them together into a Map.
 * 
 * @param values 
 * @param groupKeyFn 
 * @returns 
 */
export function makeValuesGroupMap<T, K extends PrimativeKey = PrimativeKey>(values: T[], groupKeyFn: ReadKeyFunction<T, K>): Map<K, T[]> {
  const map = new Map<K, T[]>();

  values.forEach((x) => {
    const key = groupKeyFn(x);
    let array = map.get(key);

    if (array != null) {
      array.push(x);
    } else {
      map.set(key, [x]);
    }
  });

  return map;
}
