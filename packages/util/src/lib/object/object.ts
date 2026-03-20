import { arrayDecision } from '../array/array.find';
import { type PrimativeKey, type FieldOfType } from '../key';
import { type SetIncludesMode } from '../set/set.mode';
import { type KeyAsString } from '../type';

/**
 * Any valid Plain-old Javascript Object key.
 */
export type POJOKey = PrimativeKey | symbol;

/**
 * This is an object that can be serialized to JSON and back and be equivalent.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JsonSerializableObject = Record<PrimativeKey, any>;

/**
 * String key of an object.
 */
export type ObjectKey = string;

/**
 * An object with no keys.
 */
export type EmptyObject = Record<string, never>;

/**
 * Checks whether the object has no own enumerable keys.
 *
 * @param obj - Object to check
 * @returns `true` if the object has zero keys
 */
export function objectHasNoKeys(obj: object): obj is EmptyObject {
  return Object.keys(obj).length === 0;
}

/**
 * Checks whether the object has the specified own property using `Object.prototype.hasOwnProperty`.
 *
 * @param obj - Object to check
 * @param key - Property key to test for
 * @returns `true` if the object has the key as an own property
 */
export function objectHasKey<T>(obj: T, key: KeyAsString<keyof T>): boolean;
export function objectHasKey(obj: unknown, key: string): boolean;
export function objectHasKey<T, K extends keyof T>(obj: T, key: K): boolean;
export function objectHasKey<T>(obj: T, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * Checks whether the object has all or any of the specified keys, based on the mode.
 *
 * @param obj - Object to check
 * @param keys - Keys to test for
 * @param mode - Whether to require 'all' keys or just 'any'; defaults to 'all'
 * @returns `true` if the keys match the mode criteria
 */
export function objectHasKeys<T>(obj: T, keys: KeyAsString<keyof T>[], mode?: SetIncludesMode): boolean;
export function objectHasKeys(obj: unknown, keys: ObjectKey[], mode?: SetIncludesMode): boolean;
export function objectHasKeys<T, K extends keyof T>(obj: T, keys: K[], mode?: SetIncludesMode): boolean;
export function objectHasKeys<T>(obj: T, keys: ObjectKey[], mode?: SetIncludesMode): boolean {
  return arrayDecision(keys, (key) => objectHasKey(obj, key), mode ?? 'all');
}

/**
 * Creates a partial object with the same value assigned to each of the specified fields.
 *
 * @param value - The value to assign to each field
 * @param fields - Array of field names to set
 * @returns A partial object with the value set on each specified field
 */
export function applyToMultipleFields<T extends object, X = unknown>(value: X, fields: FieldOfType<T>[]): Partial<{ [K in keyof T]: X }> {
  const result = {} as { [K in keyof T]: X };

  fields.forEach((field) => {
    result[field] = value;
  });

  return result;
}

/**
 * Converts a Map to a plain object by iterating entries and assigning key-value pairs.
 *
 * @param map - Map to convert
 * @returns A plain object with the same key-value pairs
 */
export function mapToObject<T, K extends PropertyKey>(map: Map<K, T>): { [key: PropertyKey]: T } {
  const object = {} as { [key: PropertyKey]: T };

  map.forEach((x: T, key: K) => {
    object[key] = x;
  });

  return object;
}

/**
 * Returns a copy of the input object.
 */
export type CopyObjectFunction<T> = (input: T) => T;

/**
 * Creates a shallow copy of an object using the spread operator.
 *
 * @param input - Object to copy
 * @returns A new object with the same properties
 */
export function copyObject<T extends object>(input: T): T {
  return { ...input };
}
