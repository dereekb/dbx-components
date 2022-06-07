import { FieldOfType } from '../key';
import { hasValueOrNotEmpty, Maybe } from '../value/maybe';
import { filterMaybeValues } from '../array/array.value';
import { FilterFunction, invertFilter } from '../filter/filter';

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

// MARK:
/**
 * Recursively function that returns true if the input is not an object or if every key on the object is empty.
 *
 * @param obj
 */
export function objectIsEmpty<T extends object>(obj: Maybe<T>): boolean {
  if (obj != null && typeof obj === 'object') {
    const keys = Object.keys(obj);

    if (keys.length > 0) {
      for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i];
        const value = (obj as T)[key as keyof T];
        const isEmpty = typeof obj === 'object' ? objectIsEmpty<object>(value as unknown as Maybe<object>) : !hasValueOrNotEmpty(value);

        if (!isEmpty) {
          return false;
        }
      }
    }
  }

  return true;
}
