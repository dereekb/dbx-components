/**
 * An object with values of a specific type keyed by either string or number or symbols.
 */
export type ObjectMap<T, K extends keyof any = string | number | symbol> = Record<K, T>;

/**
 * An object with values of a specific type keyed to string values.
 */
export type StringObjectMap<T> = {
  [key: string]: T;
  [key: number]: never;
  [key: symbol]: never;
}

export type MappedObjectMap<M extends object, O> = {
  [key in keyof M]: O;
};

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
  return keys.map(x => ([x, (object[x])]));
}

/**
 * Maps the values of an ObjectMap from one type to another and returns an ObjectMap containing that type.
 * 
 * @param object 
 */
export function mapObjectMap<M extends ObjectMap<I>, I = unknown, O = unknown>(object: M, mapFn: <K extends keyof M>(value: M[K], key: K) => O): MappedObjectMap<M, O> {
  const mappedObject: MappedObjectMap<M, O> = {} as MappedObjectMap<M, O>;

  const keys = Object.keys(object) as (keyof M)[];
  keys.forEach(<K extends keyof M>(key: K) => {
    const value: M[K] = object[key];
    mappedObject[key] = mapFn(value, key);
  });

  return mappedObject;
}
