
/**
 * An object with values of a specific type keyed to string values.
 */
export type ObjectMap<T> = {
  [key: string]: T;
}

/**
 * Converts an ObjectMap into a Map.
 * 
 * @param object 
 * @returns 
 */
export function objectToMap<T>(object: ObjectMap<T>): Map<string, T> {
  return new Map(objectToTuples(object));
}

/**
 * Converts an ObjectMap into tuples.
 * 
 * @param object 
 * @returns 
 */
export function objectToTuples<T>(object: ObjectMap<T>): [string, T][] {
  const keys = Object.keys(object);
  return keys.map(x => ([x, object[x]]));
}
