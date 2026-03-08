import { type MapFunction } from '../value/map';
import { type POJOKey } from './object';

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

/**
 * Mapped type that preserves the keys of `M` but replaces all value types with `O`.
 */
export type MappedObjectMap<M extends object, O> = {
  [key in keyof M]: O;
};

/**
 * Converts an {@link ObjectMap} into a `Map` using `Object.entries`.
 *
 * @param object - The object map to convert
 * @returns A `Map` with the same key-value pairs
 */
export function objectToMap<T>(object: ObjectMap<T>): Map<string, T> {
  return new Map(Object.entries(object));
}

/**
 * Maps an ObjectMap of one type to another ObjectMap with the mapped values.
 */
export type MapObjectMapFunction<M extends ObjectMap<I>, I = unknown, O = unknown> = MapFunction<M, MappedObjectMap<M, O>>;

/**
 * Creates a reusable {@link MapObjectMapFunction} that applies {@link mapObjectMap} with the given mapping function.
 *
 * @param mapFn - Function that transforms each value (receives value and key)
 * @returns A function that maps all values in an input object map
 */
export function mapObjectMapFunction<M extends ObjectMap<I>, I = unknown, O = unknown>(mapFn: MapObjectMapValueFunction<M, I, O>): MapObjectMapFunction<M, I, O> {
  return (object) => mapObjectMap(object, mapFn);
}

/**
 * Mapping function that transforms a single value from an {@link ObjectMap}, receiving both the value and its key.
 */
export type MapObjectMapValueFunction<M extends ObjectMap<I>, I = unknown, O = unknown> = <K extends keyof M>(value: M[K], key: K) => O;

/**
 * Maps all values of an {@link ObjectMap} from one type to another, returning a new object with the same keys.
 *
 * @param object - The source object map
 * @param mapFn - Function that transforms each value
 * @returns A new object with mapped values
 */
export function mapObjectMap<M extends ObjectMap<I>, I = unknown, O = unknown>(object: M, mapFn: MapObjectMapValueFunction<M, I, O>): MappedObjectMap<M, O> {
  const mappedObject = {} as MappedObjectMap<M, O>;
  return mapObjectToTargetObject(object, mappedObject, mapFn);
}

/**
 * Maps the values of a source {@link ObjectMap} and assigns the results onto the target object, returning the target.
 *
 * @param object - The source object map
 * @param target - The target object to assign mapped values onto
 * @param mapFn - Function that transforms each value
 * @returns The target object with mapped values assigned
 */
export function mapObjectToTargetObject<M extends ObjectMap<I>, I = unknown, O = unknown>(object: M, target: MappedObjectMap<M, O>, mapFn: MapObjectMapValueFunction<M, I, O>): MappedObjectMap<M, O> {
  const keys = Object.keys(object);

  keys.forEach(<K extends keyof M>(key: K) => {
    const value: M[K] = object[key];
    target[key] = mapFn(value, key);
  });

  return target;
}

/**
 * Maps each key of the input object to a new object using the pre-configured function.
 */
export type MapObjectKeysFunction<M> = (object: M) => any;

/**
 * Map function that returns the new POJOKey using the input key/value pair.
 */
export type MapObjectKeyFunction<M> = <K extends keyof M>(key: K, value: M[K]) => POJOKey;

/**
 * Creates a reusable {@link MapObjectKeysFunction} that transforms the keys of an input object using the given mapping function.
 *
 * @param mapKeyFn - Function that computes the new key from the old key and its value
 * @returns A function that remaps keys on any input object
 */
export function mapObjectKeysFunction<M extends object>(mapKeyFn: MapObjectKeyFunction<M>): MapObjectKeysFunction<M> {
  return (object: M) => {
    const target: any = {};

    Object.entries(object).forEach(([key, value]) => {
      const newKey = mapKeyFn(key as keyof M, value);
      target[newKey] = value;
    });

    return target;
  };
}

/**
 * Mapped type that converts all string keys of `M` to lowercase while preserving their value types.
 */
export type MappedKeysToLowercaseObjectMap<M extends object> = {
  [K in keyof M as K extends string ? Lowercase<K> : K]: M[K];
};

/**
 * Pre-built function that maps all string keys of an object to lowercase, returning a new object.
 *
 * Non-string keys (e.g., numbers) are passed through unchanged.
 * When multiple keys map to the same lowercase key, the last one wins (order is undefined).
 */
export const mapObjectKeysToLowercase = mapObjectKeysFunction((key) => {
  let nextKey = key as POJOKey;

  if (typeof key === 'string') {
    nextKey = key.toLowerCase();
  }

  return nextKey;
}) as <M extends object>(object: M) => MappedKeysToLowercaseObjectMap<M>;
