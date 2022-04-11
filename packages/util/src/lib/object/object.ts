import { FieldOfType } from "../key";
import { hasValueOrNotEmpty, Maybe } from "../value/maybe";
import { filterMaybeValues } from '../array/array.value';
import { invertFilter } from "../filter/filter";

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

export interface FilterFromPOJO<T extends object> {
  copy?: boolean;
  filter?: Omit<FilterKeyValueTuples<T>, 'inverse'>;
}

/**
 * Removes values, per the the filter config, from the input object.
 * 
 * @param obj POJO to remove undefined values from.
 * @param copy Whether or not to return a copy of the input object. Default is true.
 */
export function filterFromPOJO<T extends object = object>(obj: T, { copy = false, filter = { valueFilter: KeyValueTypleValueFilter.UNDEFINED } }: FilterFromPOJO<T> = {}): T {
  if (copy) {
    obj = {
      ...obj
    };
  }

  forEachKeyValue<T>(obj, {
    filter: {
      ...filter,
      invertFilter: !filter.invertFilter
    },
    forEach: ([key]) => {
      delete (obj as any)[key];
    }
  });

  return obj;
}

export function assignValuesToPOJO<T extends object = object>(target: T, obj: T, filter: FilterKeyValueTuplesInput<T> = KeyValueTypleValueFilter.UNDEFINED): T {
  forEachKeyValue<T>(obj, {
    filter,
    forEach: ([key, value]) => {
      target[key] = value;
    }
  });

  return obj;
}

export type KeyValueTuple<T extends object = object, K extends keyof T = keyof T> = [K, T[K]];

export enum KeyValueTypleValueFilter {
  NONE = 0,
  UNDEFINED = 1,
  NULL = 2,
  FALSY = 3
}

export type ForEachKeyValueFunction<T extends object = object, K extends keyof T = keyof T> = (tuple: KeyValueTuple<T, K>, index: number) => void;

export interface ForEachKeyValue<T extends object = object, K extends keyof T = keyof T> {
  filter?: FilterKeyValueTuplesInput<T, K>;
  forEach: ForEachKeyValueFunction<T, K>;
}

export function forEachKeyValue<T extends object = object, K extends keyof T = keyof T>(obj: T, { forEach, filter }: ForEachKeyValue<T, K>): void {
  const keyValues = toKeyValueTuples<T, K>(obj, filter);
  keyValues.forEach(forEach);
}

export function toKeyValueTuples<T extends object = object, K extends keyof T = keyof T>(obj: T, filter?: FilterKeyValueTuplesInput<T, K>): KeyValueTuple<T, K>[] {
  let pairs: KeyValueTuple<T, K>[] = Object.entries(obj) as KeyValueTuple<T, K>[];

  if (filter) {
    const filterFn = filterKeyValueTuplesFn<T, K>(filter);
    pairs = pairs.filter(filterFn);
  }

  return pairs;
}

export type FilterKeyValueTuplesInput<T extends object = object, K extends keyof T = keyof T> = KeyValueTypleValueFilter | FilterKeyValueTuples<T, K>;

export interface FilterKeyValueTuples<T extends object = object, K extends keyof T = keyof T> {
  valueFilter?: KeyValueTypleValueFilter;
  invertFilter?: boolean;
  keysFilter?: K[];
}

export function filterKeyValueTuplesFn<T extends object = object, K extends keyof T = keyof T>(input: FilterKeyValueTuplesInput<T, K>): (tuples: KeyValueTuple<T, K>) => boolean {
  const filter = (typeof input === 'object') ? input as FilterKeyValueTuples<T, K> : { valueFilter: input };
  const { valueFilter: type, invertFilter: inverseFilter, keysFilter }: FilterKeyValueTuples<T, K> = filter;

  let filterFn: (tuples: KeyValueTuple<T, K>) => boolean;

  switch (type) {
    case KeyValueTypleValueFilter.UNDEFINED:
      filterFn = ([_, x]) => x !== undefined;
      break;
    case KeyValueTypleValueFilter.NULL:
      filterFn = ([_, x]) => x != null;
      break;
    case KeyValueTypleValueFilter.FALSY:
      filterFn = ([_, x]) => Boolean(x);
      break;
    case KeyValueTypleValueFilter.NONE:
    default:
      filterFn = () => true;
      break;
  }

  if (keysFilter) {
    const filterByTypeFn = filterFn!;
    const keysSet = new Set(keysFilter);
    filterFn = (x) => filterByTypeFn(x) && keysSet.has(x[0]);
  }

  return invertFilter(filterFn!, inverseFilter);
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

/**
 * Merges all input objects into one. The order of overrides is kept, so the right-most item in the array will have priority over all objects before it.
 * 
 * @param objects 
 */
export function mergeObjects<T extends object>(objects: Maybe<Partial<T>>[], filter?: FilterKeyValueTuples<T>): Partial<T> {
  let object: Partial<T> = {};
  overrideInObject(object, { from: filterMaybeValues(objects), filter });
  return object;
}

/**
 * Assigns all undefined valeus from one or more objects into the target object.
 * 
 * @param object 
 */
export function overrideInObject<T extends object>(target: Partial<T>, { from, filter }: { from: Partial<T>[], filter?: FilterKeyValueTuples<T> }): Partial<T> {
  from.forEach(((x) => {
    const relevantValues = filterFromPOJO({ ...x } as T, { filter, copy: false });
    Object.assign(target, relevantValues);
  }));

  return target;
}
