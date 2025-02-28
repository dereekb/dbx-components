import { type ArrayOrValue, asArray } from './../array/array';
import { filterMaybeArrayValues } from '../array/array.value';
import { type Maybe } from '../value/maybe.type';
import { filterKeyValueTuplesFunction, type FilterKeyValueTuplesInput, filterKeyValueTuplesInputToFilter, type KeyValueTuple, type KeyValueTupleFilter, KeyValueTypleValueFilter } from './object.filter.tuple';
import { cachedGetter, type Getter } from '../getter';
import { copyObject } from './object';
import { invertBooleanReturnFunction } from '../function/function.boolean';

// MARK: Object Merging/Overriding
/**
 * Assigns all undefined values from one or more objects into the target object.
 *
 * @param object
 */
export function overrideInObject<T extends object>(target: Partial<T>, { copy = false, from, filter }: { copy?: boolean; from: ArrayOrValue<Partial<T>>; filter?: KeyValueTupleFilter<T> }): Partial<T> {
  return overrideInObjectFunctionFactory({
    copy,
    filter,
    dynamic: true // using only once, so no need to use the cache
  })(asArray(from))(target);
}

export type OverrideInObjectFunction<T> = (target: Partial<T>) => Partial<T>;
export type OverrideInObjectFunctionFactory<T> = (from: Partial<T>[]) => OverrideInObjectFunction<T>;

export interface OverrideInObjectFunctionFactoryConfig<T extends object> {
  filter?: FilterKeyValueTuplesInput<T>;
  /**
   * Whether or not to return a copy of the input value, rather than change it directly.
   * If true, a copy of the input object will be returned.
   * If false, the input object will be modified.
   *
   * False by default.
   */
  copy?: boolean;
  /**
   * Whether or not the template being applied to objects should be recalculated each time.
   *
   * This is only necessary if you expect the input targets to change and you want those changes reflected in your copy functions.
   *
   * False by default.
   */
  dynamic?: boolean;
}

export function overrideInObjectFunctionFactory<T extends object>({ filter, copy, dynamic = false }: OverrideInObjectFunctionFactoryConfig<T>): OverrideInObjectFunctionFactory<T> {
  const filterToRelevantValuesObject = filter != null ? filterFromPOJOFunction({ filter, copy: false }) : defaultFilterFromPOJOFunctionNoCopy;

  return (from: Partial<T>[]) => {
    const rebuildTemplate: Getter<Partial<T>> = () => {
      const template = {};

      from.forEach((x) => {
        const relevantValues = filterToRelevantValuesObject({ ...x } as T);
        Object.assign(template, relevantValues);
      });

      return template;
    };

    const templateGetter: Getter<Partial<T>> = dynamic ? rebuildTemplate : cachedGetter(rebuildTemplate);

    return (target: Partial<T>) => {
      const template = templateGetter();

      if (copy) {
        target = copyObject(target);
      }

      Object.assign(target, template);
      return target;
    };
  };
}

/**
 * Merges all input objects into one. The order of overrides is kept, so the right-most item in the array will have priority over all objects before it.
 *
 * @param objects
 */
export function mergeObjects<T extends object>(objects: Maybe<Partial<T>>[], filter?: FilterKeyValueTuplesInput<T>): Partial<T> {
  return mergeObjectsFunction(filter)(objects);
}

/**
 * Merges all values from the input objects into a single object.
 *
 * The order of overrides is kept, so the right-most item in the array will have priority over all objects before it.
 */
export type MergeObjectsFunction<T extends object> = (objects: Maybe<Partial<T>>[]) => Partial<T>;

export function mergeObjectsFunction<T extends object>(filter?: FilterKeyValueTuplesInput<T>): MergeObjectsFunction<T> {
  const overrideFn = overrideInObjectFunctionFactory({
    filter,
    copy: false, // blank target object is passed
    dynamic: true // no need to use cache, as cache won't be used.
  });

  return (objects: Maybe<Partial<T>>[]) => overrideFn(filterMaybeArrayValues(objects))({});
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
 * Returns a copy of the input object with all falsy and empty filtered from it.
 *
 * @param obj
 * @returns
 */
export const filterFalsyAndEmptyValues: GeneralFilterFromPOJOFunction = filterFromPOJOFunction({ copy: true, filter: { valueFilter: KeyValueTypleValueFilter.FALSY_AND_EMPTY } }) as GeneralFilterFromPOJOFunction;

/**
 * Returns all keys that are not associated with an undefined value.
 *
 * @param obj
 * @returns
 */
export const allNonUndefinedKeys: GeneralFindPOJOKeysFunction = findPOJOKeysFunction({ valueFilter: KeyValueTypleValueFilter.UNDEFINED });

/**
 * Returns all keys that are not associated with a falsy or empty value.
 *
 * @param obj
 * @returns
 */
export const allFalsyOrEmptyKeys: GeneralFindPOJOKeysFunction = findPOJOKeysFunction({ valueFilter: KeyValueTypleValueFilter.FALSY_AND_EMPTY });

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
export type FilterFromPOJOFunction<T> = (input: T, copyOverride?: Maybe<boolean>) => T;
export type GeneralFilterFromPOJOFunction<X = object> = <T extends X>(input: T) => T;

export function filterFromPOJOFunction<T extends object>({ copy = false, filter: inputFilter = { valueFilter: KeyValueTypleValueFilter.UNDEFINED } }: FilterFromPOJO<T> = {}): FilterFromPOJOFunction<T> {
  const filter = filterKeyValueTuplesInputToFilter<T>(inputFilter);
  filter.invertFilter = !filter.invertFilter; // use the inversion of the filter to retain values

  const forEachFn = forEachKeyValueOnPOJOFunction<T, void>({
    filter,
    forEach: ([key], i: number, object: T) => {
      delete object[key];
    }
  });

  return (obj: T, copyOverride?: Maybe<boolean>) => {
    const copyObj = typeof copyOverride === 'boolean' ? copyOverride : copy;

    if (copyObj) {
      obj = {
        ...obj
      };
    }

    forEachFn(obj);

    return obj;
  };
}

/**
 * Convenience function from filterFromPOJOFunction with copy set to false and using the default filter.
 */
export const defaultFilterFromPOJOFunctionNoCopy: FilterFromPOJOFunction<object> = filterFromPOJOFunction({ copy: false });

// MARK: AssignValuesToPOJO
export function assignValuesToPOJO<T extends object, K extends keyof T = keyof T>(target: T, obj: T, input?: AssignValuesToPOJOFunctionInput<T, K>): T {
  return assignValuesToPOJOFunction<T, K>(input)(target, obj);
}

export type AssignValuesToPOJOCopyFunction<T> = (target: T, obj: T, returnCopy: true) => T;
export type AssignValuesToPOJONoCopyFunction<T> = <I extends T>(target: I, obj: T, returnCopy: false) => I;

/**
 * Assigns values from the object to the target based on the configuration, and returns the result.
 *
 * Additional argument available to return a copy instead of assigning to the input value.
 */
export type AssignValuesToPOJOFunction<T> = ((target: T, obj: T, returnCopy?: boolean) => T) &
  AssignValuesToPOJOCopyFunction<T> &
  AssignValuesToPOJONoCopyFunction<T> & {
    readonly _returnCopyByDefault: boolean;
  };

export type AssignValuesToPOJOFunctionInput<T extends object = object, K extends keyof T = keyof T> =
  | KeyValueTypleValueFilter
  | (KeyValueTupleFilter<T, K> & {
      /**
       * Whether or not to copy the object before assigning values, and returning the new object.
       *
       * True by default.
       */
      copy?: boolean;
    });

/**
 * Creates a AssignValuesToPOJOFunction from the input values.
 *
 * @param input
 * @returns
 */
export function assignValuesToPOJOFunction<T extends object, K extends keyof T = keyof T>(input: AssignValuesToPOJOFunctionInput<T, K> = KeyValueTypleValueFilter.UNDEFINED): AssignValuesToPOJOFunction<T> {
  const filter: FilterKeyValueTuplesInput<T> = input;
  const copy = (typeof input === 'object' ? input.copy : true) ?? true;

  const assignEachValueToTarget = forEachKeyValueOnPOJOFunction<T, T>({
    filter,
    forEach: ([key, value], i, object: T, target: T) => {
      target[key] = value;
    }
  });

  const fn = <I extends T>(inputTarget: I, obj: T, returnCopy = copy) => {
    const target = returnCopy ? { ...inputTarget } : inputTarget;
    assignEachValueToTarget(obj, target);
    return target;
  };

  fn._returnCopyByDefault = copy;

  return fn;
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

// MARK: Filter Keys
/**
 * Returns a FilterTuplesOnPOJOFunction that returns an object that contains only the input keys, or does not contain the input keys if invertFilter is true.
 *
 * @param keysToFilter
 * @returns
 */
export function filterKeysOnPOJOFunction<T extends object>(keysToFilter: Iterable<string>, invertFilter = false): FilterTuplesOnPOJOFunction<T> {
  const keysSet = new Set(keysToFilter);
  const filterFn = invertBooleanReturnFunction(([key]) => keysSet.has(key), invertFilter);
  return filterTuplesOnPOJOFunction(filterFn);
}

export type FilterTuplesOnPOJOFilter<T extends object> = Parameters<ReturnType<typeof Object.entries<T>>['filter']>['0'];

/**
 * Function that filters keys/values on a POJO using the pre-configured function.
 */
export type FilterTuplesOnPOJOFunction<T extends object> = T extends Record<string, infer I> ? (input: T) => Record<string, I> : (input: T) => Partial<T>;

export function filterTuplesOnPOJOFunction<T extends object>(filterTupleOnObject: FilterTuplesOnPOJOFilter<T>): FilterTuplesOnPOJOFunction<T> {
  return ((input: T) => {
    const result: Partial<T> = {};

    Object.entries<T>(input as any)
      .filter(filterTupleOnObject)
      .forEach((tuple) => {
        (result as any)[tuple[0]] = tuple[1];
      });

    return result;
  }) as FilterTuplesOnPOJOFunction<T>;
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
