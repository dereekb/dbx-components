import { arrayDecision } from '../array/array.find';
import { type PrimativeKey, type FieldOfType } from '../key';
import { type SetIncludesMode } from '../set/set.mode';
import { type KeyAsString } from '../type';

/**
 * Any valid Plain-old Javascript Object key.
 */
export type POJOKey = PrimativeKey | symbol;

/**
 * String key of an object.
 */
export type ObjectKey = string;
export type EmptyObject = Record<string, never>;

export function objectHasNoKeys(obj: object): obj is EmptyObject {
  return Object.keys(obj).length === 0;
}

export function objectHasKey<T>(obj: T, key: KeyAsString<keyof T>): boolean;
export function objectHasKey(obj: unknown, key: string): boolean;
export function objectHasKey<T, K extends keyof T>(obj: T, key: K): boolean;
export function objectHasKey<T>(obj: T, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * Returns true if the object has all or any of the keys, based on the input mode. Defaults to all.
 *
 * @param obj
 * @param keys
 */
export function objectHasKeys<T>(obj: T, keys: KeyAsString<keyof T>[], mode?: SetIncludesMode): boolean;
export function objectHasKeys(obj: unknown, keys: ObjectKey[], mode?: SetIncludesMode): boolean;
export function objectHasKeys<T, K extends keyof T>(obj: T, keys: K[], mode?: SetIncludesMode): boolean;
export function objectHasKeys<T>(obj: T, keys: ObjectKey[], mode?: SetIncludesMode): boolean {
  return arrayDecision(keys, (key) => objectHasKey(obj, key), mode ?? 'all');
}

export function applyToMultipleFields<T extends object, X = unknown>(value: X, fields: FieldOfType<T>[]): Partial<{ [K in keyof T]: X }> {
  const result = {} as { [K in keyof T]: X };

  fields.forEach((field) => {
    result[field] = value;
  });

  return result;
}

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
 * @param input
 * @returns
 */
export function copyObject<T extends object>(input: T): T {
  return { ...input };
}
