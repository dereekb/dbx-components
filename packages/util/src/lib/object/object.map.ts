import { type MapFunction } from '../value/map';

/**
 * An object with values of a specific type keyed by either string or number or symbols.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ObjectMap<T, K extends keyof any = string | number | symbol> = Record<K, T>;

/**
 * An object with values of a specific type keyed to string values.
 */
export type StringObjectMap<T> = {
  [key: string]: T;
  [key: number]: never;
  [key: symbol]: never;
};

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
  return keys.map((x) => [x, object[x]]);
}

/**
 * Maps an ObjectMap of one type to another ObjectMap with the mapped values.
 */
export type MapObjectMapFunction<M extends ObjectMap<I>, I = unknown, O = unknown> = MapFunction<M, MappedObjectMap<M, O>>;

/**
 * Creates a MapObjectMapFunction that calls mapObjectMap().
 *
 * @param mapFn
 * @returns
 */
export function mapObjectMapFunction<M extends ObjectMap<I>, I = unknown, O = unknown>(mapFn: MapObjectMapValueFunction<M, I, O>): MapObjectMapFunction<M, I, O> {
  return (object) => mapObjectMap(object, mapFn);
}

export type MapObjectMapValueFunction<M extends ObjectMap<I>, I = unknown, O = unknown> = <K extends keyof M>(value: M[K], key: K) => O;

/**
 * Maps the values of an ObjectMap from one type to another and returns an ObjectMap containing that type.
 *
 * @param object
 */
export function mapObjectMap<M extends ObjectMap<I>, I = unknown, O = unknown>(object: M, mapFn: MapObjectMapValueFunction<M, I, O>): MappedObjectMap<M, O> {
  const mappedObject = {} as MappedObjectMap<M, O>;
  return mapObjectToTargetObject(object, mappedObject, mapFn);
}

/**
 * Maps the values of an ObjectMap from one type to the target and return the target.
 *
 * @param object
 * @param target
 * @param mapFn
 * @returns
 */
export function mapObjectToTargetObject<M extends ObjectMap<I>, I = unknown, O = unknown>(object: M, target: MappedObjectMap<M, O>, mapFn: MapObjectMapValueFunction<M, I, O>): MappedObjectMap<M, O> {
  const keys = Object.keys(object);

  keys.forEach(<K extends keyof M>(key: K) => {
    const value: M[K] = object[key];
    target[key] = mapFn(value, key);
  });

  return target;
}
