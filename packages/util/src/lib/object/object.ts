import { isNotEmptyObject } from "class-validator";
import { FieldOfType } from "../key";
import { hasValueOrNotEmpty, Maybe } from "../value";

export function objectHasKey<T, K extends keyof T = keyof T>(obj: T, key: K): boolean;
export function objectHasKey<T>(obj: T, key: string): boolean;
export function objectHasKey<T>(obj: T, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

export function applyToMultipleFields<T extends object>(value: any, fields: FieldOfType<T>[]): Partial<T> {
  const result: any = {};

  fields.forEach((field) => {
    result[field] = value;
  });

  return result;
}

export function mapToObject<T, K extends PropertyKey>(map: Map<K, T>): { [key: string]: T } {
  const object = {} as any;

  map.forEach((x: T, key: K) => {
    object[key] = x;
  });

  return object;
}


/**
 * Removes all undefined values from the input POJO. Will only remove undefined, and not null, etc.
 * 
 * @param obj POJO to remove undefined values from.
 * @param copy Whether or not to return a copy with all non-
 */
export function removeUndefinedFromPOJO<T extends object = object>(obj: T, copy?: boolean): T {
  if (copy) {
    obj = {
      ...obj
    };
  }

  Object.keys(obj).forEach((key: string) => {
    if ((obj as any)[key] === undefined) {
      delete (obj as any)[key];
    }
  });

  return obj;
}

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
        const value = (obj as any)[key];

        const isEmpty = (typeof obj === 'object') ? objectIsEmpty(value) : !hasValueOrNotEmpty(value);

        if (!isEmpty) {
          return false;
        }
      }
    }

  }

  return true;
}