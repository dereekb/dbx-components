import { FieldOfType } from '../key';

export type EmptyObject = Record<string, never>;

export function objectHasNoKeys(obj: object): obj is EmptyObject {
  return Object.keys(obj).length === 0;
}

export function objectHasKey<T, K extends keyof T = keyof T>(obj: T, key: K): boolean;
export function objectHasKey<T>(obj: T, key: string): boolean;
export function objectHasKey<T>(obj: T, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
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
