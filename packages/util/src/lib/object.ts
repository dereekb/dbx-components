import { FieldOfType } from "./key";

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
