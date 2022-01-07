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
