import { Maybe } from '../value/maybe.type';
import { filterMaybeValues } from '../array/array.value';
import { filterKeyValueTuplesFunction, FilterKeyValueTuplesInput, filterKeyValueTuplesInputToFilter, KeyValueTuple, KeyValueTupleFilter, KeyValueTypleValueFilter } from './object.filter.tuple';

// MARK: Object Merging/Overriding
/**
 * Assigns all undefined values from one or more objects into the target object.
 *
 * @param object
 */
export function overrideInObject<T extends object>(target: Partial<T>, { from, filter }: { from: Partial<T>[]; filter?: KeyValueTupleFilter<T> }): Partial<T> {
  const filterToRelevantValuesObject = filterFromPOJOFunction({ copy: false, filter });

  from.forEach((x) => {
    const relevantValues = filterToRelevantValuesObject({ ...x } as T);
    Object.assign(target, relevantValues);
  });

  return target;
}

/**
 * Merges all input objects into one. The order of overrides is kept, so the right-most item in the array will have priority over all objects before it.
 *
 * @param objects
 */
export function mergeObjects<T extends object>(objects: Maybe<Partial<T>>[], filter?: KeyValueTupleFilter<T>): Partial<T> {
  const object: Partial<T> = {};
  overrideInObject(object, { from: filterMaybeValues(objects), filter });
  return object;
}

// MARK: POJO
/**
 * Returns a copy of the input object with all undefined (and null values if filterNull=true) values filtered/removed from it.
 *
 * @param obj
 * @returns
 */
export function filterUndefinedValues<T extends object>(obj: T, filterNull = false): T {
  const filterFn = filterNull ? filterNullAndUndefinedValues : filterOnlyUndefinedValues;
  return filterFn(obj) as T;
}

/**
 * Returns a copy of the input object with all undefined values filtered from it.
 *
 * @param obj
 * @returns
 */
export const filterOnlyUndefinedValues: GeneralFilterFromPOJOFunction = filterFromPOJOFunction({ copy: true, filter: { valueFilter: KeyValueTypleValueFilter.UNDEFINED } }) as GeneralFilterFromPOJOFunction;

/**
 * Returns a copy of the input object with all null and undefined values filtered from it.
 *
 * @param obj
 * @returns
 */
export const filterNullAndUndefinedValues: GeneralFilterFromPOJOFunction = filterFromPOJOFunction({ copy: true, filter: { valueFilter: KeyValueTypleValueFilter.NULL } }) as GeneralFilterFromPOJOFunction;

/**
 * Returns all keys that are not associated with an undefined value.
 *
 * @param obj
 * @returns
 */
export const allNonUndefinedKeys: GeneralFindPOJOKeysFunction = findPOJOKeysFunction({ valueFilter: KeyValueTypleValueFilter.UNDEFINED });

/**
 * Returns all keys that are not associated with a null/undefined value.
 *
 * @param obj
 * @returns
 */
export const allMaybeSoKeys: GeneralFindPOJOKeysFunction = findPOJOKeysFunction({ valueFilter: KeyValueTypleValueFilter.NULL });

// MARK: FindPOJOKeys
/**
 * Finds keys from the POJO that meet the filter.
 *
 * @param obj
 * @param filter
 * @returns
 */
export function findPOJOKeys<T extends object>(obj: T, filter: FilterKeyValueTuplesInput<T>): (keyof T)[] {
  return findPOJOKeysFunction(filter)(obj);
}

type FindPOJOKeysContext<T> = { keys: (keyof T)[] };

/**
 * Finds and finds the number of keys from the POJO that meet the filter.
 */
export type FindPOJOKeysFunction<T> = (obj: T) => (keyof T)[];
export type GeneralFindPOJOKeysFunction = <T extends object>(obj: T) => (keyof T)[];

export function findPOJOKeysFunction<T extends object>(filter: FilterKeyValueTuplesInput<T>): FindPOJOKeysFunction<T> {
  const findEachMatchingKeyOnTarget = forEachKeyValueOnPOJOFunction<T, FindPOJOKeysContext<T>>({
    filter,
    forEach: ([key], i, obj, context: FindPOJOKeysContext<T>) => {
      context.keys.push(key);
    }
  });

  return (obj: T) => {
    const context = { keys: [] };
    findEachMatchingKeyOnTarget(obj, context);
    return context.keys;
  };
}

// MARK: CountPOJOKeys
/**
 * Finds and counts the number of keys from the POJO that meet the filter.
 *
 * @param obj
 * @param filter
 * @returns
 */
export function countPOJOKeys<T extends object>(obj: T, filter: FilterKeyValueTuplesInput<T> = KeyValueTypleValueFilter.UNDEFINED): number {
  return countPOJOKeysFunction(filter)(obj);
}

type CountPOJOKeysContext = { count: number };

/**
 * Finds and counts the number of keys from the POJO that meet the filter.
 */
export type CountPOJOKeysFunction<T> = (obj: T) => number;

export function countPOJOKeysFunction<T extends object>(filter: FilterKeyValueTuplesInput<T> = KeyValueTypleValueFilter.UNDEFINED): CountPOJOKeysFunction<T> {
  const countEachMatchingKeyOnTarget = forEachKeyValueOnPOJOFunction<T, CountPOJOKeysContext>({
    filter,
    forEach: (x, i, obj, context: CountPOJOKeysContext) => {
      context.count += 1;
    }
  });

  return (obj: T) => {
    const context = { count: 0 };
    countEachMatchingKeyOnTarget(obj, context);
    return context.count;
  };
}

// MARK: FilterFromPOJO
export interface FilterFromPOJO<T extends object> {
  copy?: boolean;
  filter?: Omit<FilterKeyValueTuplesInput<T>, 'inverse'>;
}

/**
 * Removes values, per the the filter config, from the input object.
 *
 * @param obj POJO to remove undefined values from.
 * @param copy Whether or not to return a copy of the input object. Default is true.
 */
export function filterFromPOJO<T extends object>(obj: T, config: FilterFromPOJO<T> = {}): T {
  return filterFromPOJOFunction<T>(config)(obj);
}

/**
 * Removes values from the input object.
 *
 * @param obj POJO to remove undefined values from.
 * @param copy Whether or not to return a copy of the input object. Default is true.
 */
export type FilterFromPOJOFunction<T> = (input: T) => T;
export type GeneralFilterFromPOJOFunction = <T>(input: T) => T;

export function filterFromPOJOFunction<T extends object>({ copy = false, filter: inputFilter = { valueFilter: KeyValueTypleValueFilter.UNDEFINED } }: FilterFromPOJO<T> = {}): FilterFromPOJOFunction<T> {
  const filter = filterKeyValueTuplesInputToFilter<T>(inputFilter);
  filter.invertFilter = !filter.invertFilter; // use the inversion of the filter to retain values

  const forEachFn = forEachKeyValueOnPOJOFunction<T, void>({
    filter,
    forEach: ([key], i: number, object: T) => {
      delete object[key];
    }
  });

  return (obj: T) => {
    if (copy) {
      obj = {
        ...obj
      };
    }

    forEachFn(obj);

    return obj;
  };
}

// MARK: AssignValuesToPOJO
export function assignValuesToPOJO<T extends object>(target: T, obj: T, filter?: FilterKeyValueTuplesInput<T>): T {
  return assignValuesToPOJOFunction(filter)(target, obj);
}

export type AssignValuesToPOJOFunction<T> = (target: T, obj: T) => T;

export function assignValuesToPOJOFunction<T extends object>(filter: FilterKeyValueTuplesInput<T> = KeyValueTypleValueFilter.UNDEFINED): AssignValuesToPOJOFunction<T> {
  const assignEachValueToTarget = forEachKeyValueOnPOJOFunction<T, T>({
    filter,
    forEach: ([key, value], i, object: T, target: T) => {
      target[key] = value;
    }
  });

  return (target: T, obj: T) => {
    assignEachValueToTarget(obj, target);
    return obj;
  };
}

// MARK: ValuesFromPOJO
/**
 * Reads values from matching keys based on the filter and puts them into an array.
 */
export function valuesFromPOJO<O = unknown, I extends object = object>(target: I, filter: FilterKeyValueTuplesInput<I> = KeyValueTypleValueFilter.UNDEFINED): O[] {
  return valuesFromPOJOFunction<O, I>(filter)(target);
}

type ValuesFromPOJOFunctionContext<O = unknown> = { values: O[] };

/**
 * Reads values from matching keys based on the filter and puts them into an array.
 */
export type ValuesFromPOJOFunction<O = unknown, I extends object = object> = (obj: I) => O[];

export function valuesFromPOJOFunction<O = unknown, I extends object = object>(filter: FilterKeyValueTuplesInput<I> = KeyValueTypleValueFilter.UNDEFINED): ValuesFromPOJOFunction<O, I> {
  const addValuesFromObjectToContext = forEachKeyValueOnPOJOFunction<I, ValuesFromPOJOFunctionContext<O>>({
    filter,
    forEach: ([, value], i, obj, context: ValuesFromPOJOFunctionContext) => {
      context.values.push(value);
    }
  });

  return (obj: I) => {
    const context: ValuesFromPOJOFunctionContext<O> = { values: [] };
    addValuesFromObjectToContext(obj, context);
    return context.values;
  };
}

// MARK: ForEachKeyValue
export type ForEachKeyValueOnPOJOTupleFunction<T extends object, C = unknown, K extends keyof T = keyof T> = (tuple: KeyValueTuple<T, K>, index: number, object: T, context: C) => void;
export type ForEachKeyValueOnPOJOFunction<T extends object, C = unknown> = C extends void ? ForEachKeyValueOnPOJOFunctionWithoutContext<T> : ForEachKeyValueOnPOJOFunctionWithContext<T, C>;
export type ForEachKeyValueOnPOJOFunctionWithoutContext<T extends object> = (object: T) => void;
export type ForEachKeyValueOnPOJOFunctionWithContext<T extends object, C = unknown> = (object: T, context: C) => void;
export type ForEachKeyValueOnPOJOConfig<T extends object, C = unknown, K extends keyof T = keyof T> = {
  filter?: FilterKeyValueTuplesInput<T, K>;
  forEach: ForEachKeyValueOnPOJOTupleFunction<T, C, K>;
};

export function forEachKeyValueOnPOJOFunction<T extends object, C = unknown, K extends keyof T = keyof T>({ forEach, filter }: ForEachKeyValueOnPOJOConfig<T, C, K>): ForEachKeyValueOnPOJOFunction<T, C> {
  const filterKeyValues = filterKeyValueTuplesFunction<T, K>(filter);

  return ((obj: T, context: C) => {
    const keyValues = filterKeyValues(obj);
    keyValues.forEach((x, i) => forEach(x, i, obj, context));
  }) as ForEachKeyValueOnPOJOFunction<T, C>;
}