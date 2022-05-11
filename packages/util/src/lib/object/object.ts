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
  filter?: Omit<KeyValueTupleFilter<T>, 'inverse'>;
}

/**
 * Returns a copy of the input object with all null and undefined values filtered from it.
 * 
 * @param obj 
 * @returns 
 */
export function filterNullAndUndefinedValues<T extends object = object>(obj: T) {
  return filterUndefinedValues(obj, true);
}

/**
 * Returns a copy of the input object with all undefined values filtered from it.
 * 
 * @param obj 
 * @returns 
 */
export function filterUndefinedValues<T extends object = object>(obj: T, filterNull = false) {
  return filterFromPOJO(obj, { copy: true, filter: { valueFilter: (filterNull) ? KeyValueTypleValueFilter.NULL : KeyValueTypleValueFilter.UNDEFINED } });
}

/**
 * Returns all keys that are not associated with an undefined value.
 * 
 * @param obj 
 * @returns 
 */
export function allNonUndefinedKeys<T extends object = Object>(obj: T): (keyof T)[] {
  return findPOJOKeys(obj, { valueFilter: KeyValueTypleValueFilter.UNDEFINED });
}

export function allMaybeSoKeys<T extends object = Object>(obj: T): (keyof T)[] {
  return findPOJOKeys(obj, { valueFilter: KeyValueTypleValueFilter.NULL });
}

/**
 * Finds keys from the POJO that meet the filter.
 * 
 * @param obj 
 * @param filter 
 * @returns 
 */
export function findPOJOKeys<T extends object = object>(obj: T, filter: FilterKeyValueTuplesInput<T>): (keyof T)[] {
  const keys: (keyof T)[] = [];

  forEachKeyValue<T>(obj, {
    filter,
    forEach: ([key]) => {
      keys.push(key);
    }
  });

  return keys;
}

/**
 * Finds and counts the number of keys from the POJO that meet the filter.
 * 
 * @param obj 
 * @param filter 
 * @returns 
 */
export function countPOJOKeys<T extends object = object>(obj: T, filter: FilterKeyValueTuplesInput<T> = KeyValueTypleValueFilter.UNDEFINED): number {
  let count = 0;

  forEachKeyValue<T>(obj, {
    filter,
    forEach: () => count += 1
  });

  return count;
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

/**
 * Reads all values from the pojo based on the filter and puts them into an array.
 * 
 * @param target 
 * @param filter 
 * @returns 
 */
export function valuesFromPOJO<O = any, I extends object = object>(target: I, filter: FilterKeyValueTuplesInput<I> = KeyValueTypleValueFilter.UNDEFINED): O[] {
  const values: O[] = [];

  forEachKeyValue<I>(target, {
    filter,
    forEach: ([key, value]) => {
      values.push(value as unknown as O);
    }
  });

  return values;
}

export type KeyValueTuple<T extends object = object, K extends keyof T = keyof T> = [K, T[K]];

export function allKeyValueTuples<T extends object = object, K extends keyof T = keyof T>(obj: T): KeyValueTuple<T, K>[] {
  return Object.entries(obj) as KeyValueTuple<T, K>[];
}

export enum KeyValueTypleValueFilter {
  /**
   * No filter
   */
  NONE = 0,
  /**
   * Only undefined values.
   */
  UNDEFINED = 1,
  /**
   * All values that are null or undefined.
   */
  NULL = 2,
  /**
   * All values that are falsy.
   */
  FALSY = 3
}

export type ForEachKeyValueFunction<T extends object = object, K extends keyof T = keyof T> = (tuple: KeyValueTuple<T, K>, index: number) => void;

export interface ForEachKeyValue<T extends object = object, K extends keyof T = keyof T> {
  filter?: FilterKeyValueTuplesInput<T, K>;
  forEach: ForEachKeyValueFunction<T, K>;
}

export function forEachKeyValue<T extends object = object, K extends keyof T = keyof T>(obj: T, { forEach, filter }: ForEachKeyValue<T, K>): void {
  const keyValues = filterKeyValueTuples<T, K>(obj, filter);
  keyValues.forEach(forEach);
}

export function filterKeyValueTuples<T extends object = object, K extends keyof T = keyof T>(obj: T, filter?: FilterKeyValueTuplesInput<T, K>): KeyValueTuple<T, K>[] {
  let pairs: KeyValueTuple<T, K>[] = allKeyValueTuples(obj);

  if (filter) {
    const filterFn = filterKeyValueTupleFunction<T, K>(filter);
    pairs = pairs.filter(filterFn);
  }

  return pairs;
}

export interface KeyValueTupleFilter<T extends object = object, K extends keyof T = keyof T> {
  valueFilter?: KeyValueTypleValueFilter;
  invertFilter?: boolean;
  keysFilter?: K[];
}

export type FilterKeyValueTuplesInput<T extends object = object, K extends keyof T = keyof T> = KeyValueTypleValueFilter | KeyValueTupleFilter<T, K>;

export type FilterKeyValueTupleFunction<T extends object = object, K extends keyof T = keyof T> = (tuples: KeyValueTuple<T, K>) => boolean;

export function filterKeyValueTupleFunction<T extends object = object, K extends keyof T = keyof T>(input: FilterKeyValueTuplesInput<T, K>): FilterKeyValueTupleFunction<T, K> {
  const filter = (typeof input === 'object') ? input as KeyValueTupleFilter<T, K> : { valueFilter: input };
  const { valueFilter: type, invertFilter: inverseFilter = false, keysFilter }: KeyValueTupleFilter<T, K> = filter;

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
export function mergeObjects<T extends object>(objects: Maybe<Partial<T>>[], filter?: KeyValueTupleFilter<T>): Partial<T> {
  let object: Partial<T> = {};
  overrideInObject(object, { from: filterMaybeValues(objects), filter });
  return object;
}

/**
 * Assigns all undefined valeus from one or more objects into the target object.
 * 
 * @param object 
 */
export function overrideInObject<T extends object>(target: Partial<T>, { from, filter }: { from: Partial<T>[], filter?: KeyValueTupleFilter<T> }): Partial<T> {
  from.forEach(((x) => {
    const relevantValues = filterFromPOJO({ ...x } as T, { filter, copy: false });
    Object.assign(target, relevantValues);
  }));

  return target;
}
