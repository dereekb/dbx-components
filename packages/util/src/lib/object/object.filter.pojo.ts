import { type ArrayOrValue, asArray } from './../array/array';
import { filterMaybeArrayValues } from '../array/array.value';
import { type Maybe } from '../value/maybe.type';
import { filterKeyValueTuplesFunction, type FilterKeyValueTuplesInput, filterKeyValueTuplesInputToFilter, type KeyValueTuple, type KeyValueTupleFilter, KeyValueTypleValueFilter } from './object.filter.tuple';
import { cachedGetter, type Getter } from '../getter';
import { copyObject } from './object';
import { invertBooleanReturnFunction } from '../function/function.boolean';

// MARK: Object Merging/Overriding
/**
 * Assigns all non-filtered values from one or more source objects into the target object.
 *
 * Builds a template from the source objects (in order, so later sources win) and applies it to the target.
 * By default, undefined values in the source objects are excluded from the template, so they will not override existing target values.
 *
 * @param target - The object to override values on.
 * @param config - Configuration for the override operation.
 * @param config.copy - Whether to return a shallow copy instead of mutating the target. Defaults to `false`.
 * @param config.from - One or more source objects whose values will be applied to the target.
 * @param config.filter - Optional filter to control which key/value pairs from sources are included. Defaults to filtering out `undefined` values.
 * @returns The modified target (or a copy if `copy` is `true`).
 *
 * @example
 * ```typescript
 * const target = { a: 1, b: 2 };
 * overrideInObject(target, { from: [{ a: 10, c: 3 }] });
 * // target is now { a: 10, b: 2, c: 3 }
 *
 * // undefined values in source are ignored by default:
 * overrideInObject(target, { from: [{ a: undefined, b: 99 }] });
 * // target.a remains 10, target.b becomes 99
 * ```
 */
export function overrideInObject<T extends object>(target: Partial<T>, { copy = false, from, filter }: { copy?: boolean; from: ArrayOrValue<Partial<T>>; filter?: KeyValueTupleFilter<T> }): Partial<T> {
  return overrideInObjectFunctionFactory({
    copy,
    filter,
    dynamic: true // using only once, so no need to use the cache
  })(asArray(from))(target);
}

/**
 * Applies a pre-built template of values to a target object, returning the modified target.
 */
export type OverrideInObjectFunction<T> = (target: Partial<T>) => Partial<T>;

/**
 * Factory that takes an array of source objects and produces an {@link OverrideInObjectFunction}
 * that applies the merged template to any target.
 */
export type OverrideInObjectFunctionFactory<T> = (from: Partial<T>[]) => OverrideInObjectFunction<T>;

/**
 * Configuration for {@link overrideInObjectFunctionFactory}.
 */
export interface OverrideInObjectFunctionFactoryConfig<T extends object> {
  /**
   * Filter controlling which key/value pairs from sources are included in the template.
   *
   * Accepts a {@link KeyValueTypleValueFilter} enum value or a {@link KeyValueTupleFilter} object.
   * When not provided, the default filter removes `undefined` values (i.e., `KeyValueTypleValueFilter.UNDEFINED`).
   */
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

/**
 * Creates an {@link OverrideInObjectFunctionFactory} that merges source objects into a template,
 * then applies that template to target objects.
 *
 * The template is built by iterating the source objects in order (later sources override earlier ones),
 * filtering each through the configured filter. When applied to a target, the template's values overwrite
 * corresponding keys on the target.
 *
 * By default, `undefined` values in sources are excluded from the template.
 *
 * @param config - Configuration controlling filtering, copying, and caching behavior.
 * @param config.filter - filter applied to source object values when building the template; by default, `undefined` values are excluded
 * @param config.copy - when true, the target object is shallow-copied before applying overrides instead of being mutated in place
 * @param config.dynamic - when true, the template is recalculated on each call instead of being cached; useful when source objects may change over time
 * @returns A factory function that accepts source objects and returns an override function.
 *
 * @example
 * ```typescript
 * const factory = overrideInObjectFunctionFactory({ copy: true });
 * const overrideFn = factory([{ color: 'red' }, { size: 10 }]);
 * const result = overrideFn({ color: 'blue', size: 5 });
 * // result is { color: 'red', size: 10 } (a new copy)
 * ```
 */
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
 * Merges all input objects into a single object.
 *
 * Objects are applied left-to-right, so the right-most (last) item in the array has the highest priority.
 * `Maybe` values (null/undefined entries in the array) are silently ignored.
 *
 * By default, `undefined` values within each source object are excluded from the merge,
 * meaning an `undefined` value will not overwrite a previously set value.
 *
 * @param objects - Array of objects (or null/undefined) to merge together.
 * @param filter - Optional filter controlling which key/value pairs are included. Defaults to filtering out `undefined` values (`KeyValueTypleValueFilter.UNDEFINED`).
 * @returns A new object containing the merged result.
 *
 * @example
 * ```typescript
 * const result = mergeObjects([{ a: 1, b: 2 }, { b: 3, c: 4 }]);
 * // result is { a: 1, b: 3, c: 4 }
 *
 * // undefined values in sources do not override:
 * const result2 = mergeObjects([{ a: 1 }, { a: undefined, b: 2 }]);
 * // result2 is { a: 1, b: 2 }
 * ```
 */
export function mergeObjects<T extends object>(objects: Maybe<Partial<T>>[], filter?: FilterKeyValueTuplesInput<T>): Partial<T> {
  return mergeObjectsFunction(filter)(objects);
}

/**
 * Function that merges an array of partial objects into a single object.
 * Objects are applied left-to-right, so the last item in the array has the highest priority.
 */
export type MergeObjectsFunction<T extends object> = (objects: Maybe<Partial<T>>[]) => Partial<T>;

/**
 * Creates a reusable {@link MergeObjectsFunction} with a pre-configured filter.
 *
 * Useful when you need to merge objects multiple times with the same filter configuration.
 * By default, `undefined` values are filtered out of the result (`KeyValueTypleValueFilter.UNDEFINED`).
 *
 * @param filter - Optional filter controlling which key/value pairs are included. Defaults to filtering out `undefined` values.
 * @returns A reusable merge function.
 *
 * @example
 * ```typescript
 * const merge = mergeObjectsFunction();
 * const result = merge([{ a: 1 }, { b: 2 }, { a: 3 }]);
 * // result is { a: 3, b: 2 }
 *
 * // With null filter to also exclude null values:
 * const mergeNoNulls = mergeObjectsFunction(KeyValueTypleValueFilter.NULL);
 * ```
 */
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
 * Returns a copy of the input object with all `undefined` values removed.
 * When `filterNull` is `true`, `null` values are also removed.
 *
 * This is a convenience wrapper around {@link filterOnlyUndefinedValues} and {@link filterNullAndUndefinedValues}.
 *
 * @param obj - The object to filter.
 * @param filterNull - If `true`, both `null` and `undefined` values are removed. Defaults to `false`.
 * @returns A shallow copy of the object with filtered values removed.
 *
 * @example
 * ```typescript
 * filterUndefinedValues({ a: 1, b: undefined, c: null });
 * // { a: 1, c: null }
 *
 * filterUndefinedValues({ a: 1, b: undefined, c: null }, true);
 * // { a: 1 }
 * ```
 */
export function filterUndefinedValues<T extends object>(obj: T, filterNull = false): T {
  const filterFn = filterNull ? filterNullAndUndefinedValues : filterOnlyUndefinedValues;
  return filterFn(obj) as T;
}

/**
 * Pre-built filter that returns a copy of the input object with all `undefined` values removed.
 * Keys with `null` or other falsy values are retained.
 *
 * @example
 * ```typescript
 * filterOnlyUndefinedValues({ a: 1, b: undefined, c: null });
 * // { a: 1, c: null }
 * ```
 */
export const filterOnlyUndefinedValues: GeneralFilterFromPOJOFunction = filterFromPOJOFunction({ copy: true, filter: { valueFilter: KeyValueTypleValueFilter.UNDEFINED } }) as GeneralFilterFromPOJOFunction;

/**
 * Pre-built filter that returns a copy of the input object with all `null` and `undefined` values removed.
 * Keys with other falsy values (0, false, '') are retained.
 *
 * @example
 * ```typescript
 * filterNullAndUndefinedValues({ a: 1, b: undefined, c: null, d: 0 });
 * // { a: 1, d: 0 }
 * ```
 */
export const filterNullAndUndefinedValues: GeneralFilterFromPOJOFunction = filterFromPOJOFunction({ copy: true, filter: { valueFilter: KeyValueTypleValueFilter.NULL } }) as GeneralFilterFromPOJOFunction;

/**
 * Pre-built filter that returns a copy of the input object with all empty values removed.
 * Empty values include `null`, `undefined`, empty strings (`''`), empty arrays (`[]`), and empty objects (`{}`).
 *
 * @example
 * ```typescript
 * filterEmptyPojoValues({ a: 1, b: '', c: [], d: null, e: 'hello' });
 * // { a: 1, e: 'hello' }
 * ```
 */
export const filterEmptyPojoValues: GeneralFilterFromPOJOFunction = filterFromPOJOFunction({ copy: true, filter: { valueFilter: KeyValueTypleValueFilter.EMPTY } }) as GeneralFilterFromPOJOFunction;

/**
 * Pre-built filter that returns a copy of the input object with all falsy and empty values removed.
 * Removes `null`, `undefined`, `0`, `false`, `''`, empty arrays, and empty objects.
 *
 * @example
 * ```typescript
 * filterFalsyAndEmptyValues({ a: 1, b: false, c: 0, d: '', e: 'hello' });
 * // { a: 1, e: 'hello' }
 * ```
 */
export const filterFalsyAndEmptyValues: GeneralFilterFromPOJOFunction = filterFromPOJOFunction({ copy: true, filter: { valueFilter: KeyValueTypleValueFilter.FALSY_AND_EMPTY } }) as GeneralFilterFromPOJOFunction;

/**
 * Pre-built function that returns all keys from a POJO whose values are not `undefined`.
 * Keys with `null` or other falsy values are included in the result.
 *
 * @example
 * ```typescript
 * allNonUndefinedKeys({ a: 'test', b: undefined, c: null, d: 0 });
 * // ['a', 'c', 'd']
 * ```
 */
export const allNonUndefinedKeys: GeneralFindPOJOKeysFunction = findPOJOKeysFunction({ valueFilter: KeyValueTypleValueFilter.UNDEFINED });

/**
 * Pre-built function that returns all keys from a POJO whose values are not falsy or empty.
 * Excludes keys with `null`, `undefined`, `0`, `false`, `''`, empty arrays, or empty objects.
 *
 * @example
 * ```typescript
 * allFalsyOrEmptyKeys({ a: 'test', b: false, c: 0, d: null });
 * // ['a']
 * ```
 */
export const allFalsyOrEmptyKeys: GeneralFindPOJOKeysFunction = findPOJOKeysFunction({ valueFilter: KeyValueTypleValueFilter.FALSY_AND_EMPTY });

/**
 * Pre-built function that returns all keys from a POJO whose values are not `null` or `undefined`.
 * Keys with other falsy values (0, false, '') are included.
 *
 * @example
 * ```typescript
 * allMaybeSoKeys({ a: 'test', b: undefined, c: null, d: 0 });
 * // ['a', 'd']
 * ```
 */
export const allMaybeSoKeys: GeneralFindPOJOKeysFunction = findPOJOKeysFunction({ valueFilter: KeyValueTypleValueFilter.NULL });

// MARK: FindPOJOKeys
/**
 * Finds and returns keys from the POJO whose values pass the given filter.
 *
 * The filter determines which values are considered "matching" — matched values have their keys included in the result.
 * For example, using `KeyValueTypleValueFilter.UNDEFINED` returns all keys whose values are NOT `undefined`.
 *
 * @param obj - The object to inspect.
 * @param filter - A {@link FilterKeyValueTuplesInput} controlling which key/value pairs match. Required (no default).
 * @returns Array of keys whose values pass the filter.
 *
 * @example
 * ```typescript
 * findPOJOKeys({ a: 1, b: undefined, c: null }, KeyValueTypleValueFilter.NULL);
 * // ['a'] — only 'a' has a non-null, non-undefined value
 * ```
 */
export function findPOJOKeys<T extends object>(obj: T, filter: FilterKeyValueTuplesInput<T>): (keyof T)[] {
  return findPOJOKeysFunction(filter)(obj);
}

type FindPOJOKeysContext<T> = { keys: (keyof T)[] };

/**
 * Function that returns an array of keys from a POJO whose values pass a pre-configured filter.
 */
export type FindPOJOKeysFunction<T> = (obj: T) => (keyof T)[];

/**
 * Generic version of {@link FindPOJOKeysFunction} that accepts any object type.
 */
export type GeneralFindPOJOKeysFunction = <T extends object>(obj: T) => (keyof T)[];

/**
 * Creates a reusable {@link FindPOJOKeysFunction} with a pre-configured filter.
 *
 * The returned function inspects each key/value pair on the input object and collects keys
 * whose values pass the filter.
 *
 * @param filter - A {@link FilterKeyValueTuplesInput} controlling which values match. Required (no default).
 * @returns A reusable function that returns matching keys from any input object.
 *
 * @example
 * ```typescript
 * const findDefinedKeys = findPOJOKeysFunction(KeyValueTypleValueFilter.UNDEFINED);
 * findDefinedKeys({ a: 1, b: undefined, c: 'hello' });
 * // ['a', 'c']
 * ```
 */
export function findPOJOKeysFunction<T extends object>(filter: FilterKeyValueTuplesInput<T>): FindPOJOKeysFunction<T> {
  const findEachMatchingKeyOnTarget = forEachKeyValueOnPOJOFunction<T, FindPOJOKeysContext<T>>({
    filter,
    // eslint-disable-next-line @typescript-eslint/max-params
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
 * Counts the number of keys on the POJO whose values pass the given filter.
 *
 * By default, counts all keys whose values are not `undefined` (`KeyValueTypleValueFilter.UNDEFINED`).
 *
 * @param obj - The object to inspect.
 * @param filter - A {@link FilterKeyValueTuplesInput} controlling which values are counted. Defaults to `KeyValueTypleValueFilter.UNDEFINED`.
 * @returns The number of keys whose values pass the filter.
 *
 * @example
 * ```typescript
 * countPOJOKeys({ a: 1, b: undefined, c: null });
 * // 2 — 'a' and 'c' are not undefined
 *
 * countPOJOKeys({ a: 1, b: undefined, c: null }, KeyValueTypleValueFilter.NULL);
 * // 1 — only 'a' is not null or undefined
 * ```
 */
export function countPOJOKeys<T extends object>(obj: T, filter: FilterKeyValueTuplesInput<T> = KeyValueTypleValueFilter.UNDEFINED): number {
  return countPOJOKeysFunction(filter)(obj);
}

/**
 * Function that counts the number of keys on an object whose values pass a pre-configured filter.
 */
export type CountPOJOKeysFunction<T> = (obj: T) => number;

/**
 * Creates a reusable {@link CountPOJOKeysFunction} with a pre-configured filter.
 *
 * By default, counts all keys whose values are not `undefined` (`KeyValueTypleValueFilter.UNDEFINED`).
 *
 * @param filter - A {@link FilterKeyValueTuplesInput} controlling which values are counted. Defaults to `KeyValueTypleValueFilter.UNDEFINED`.
 * @returns A reusable function that counts matching keys on any input object.
 *
 * @example
 * ```typescript
 * const countDefined = countPOJOKeysFunction();
 * countDefined({ a: 1, b: undefined, c: 'test' });
 * // 2
 * ```
 */
export function countPOJOKeysFunction<T extends object>(filter: FilterKeyValueTuplesInput<T> = KeyValueTypleValueFilter.UNDEFINED): CountPOJOKeysFunction<T> {
  type CountPOJOKeysContext = { count: number };

  const countEachMatchingKeyOnTarget = forEachKeyValueOnPOJOFunction<T, CountPOJOKeysContext>({
    filter,
    // eslint-disable-next-line @typescript-eslint/max-params
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
/**
 * Configuration for {@link filterFromPOJO} and {@link filterFromPOJOFunction}.
 */
export interface FilterFromPOJO<T extends object> {
  /**
   * Whether to return a shallow copy of the object instead of mutating the original.
   * Defaults to `false` when used via {@link filterFromPOJOFunction}, but the pre-built
   * constants (e.g., {@link filterOnlyUndefinedValues}) use `true`.
   */
  copy?: boolean;
  /**
   * Filter determining which values to remove. Accepts a {@link KeyValueTypleValueFilter} enum or a {@link KeyValueTupleFilter} object (without `inverse`).
   * Defaults to `{ valueFilter: KeyValueTypleValueFilter.UNDEFINED }`, which removes `undefined` values.
   */
  filter?: Omit<FilterKeyValueTuplesInput<T>, 'inverse'>;
}

/**
 * Removes values from the input object based on the filter configuration.
 *
 * By default, removes `undefined` values and does NOT copy the object (mutates in place).
 * Pass `{ copy: true }` to get a new object without modifying the original.
 *
 * @param obj - The POJO to filter values from.
 * @param config - Configuration for filtering and copying behavior. Defaults to removing `undefined` values without copying.
 * @returns The filtered object (either the mutated original or a shallow copy, depending on `config.copy`).
 *
 * @example
 * ```typescript
 * // Remove undefined values (default):
 * filterFromPOJO({ a: 1, b: undefined, c: 'hello' });
 * // { a: 1, c: 'hello' }
 *
 * // Remove null and undefined values:
 * filterFromPOJO({ a: 1, b: null, c: undefined }, { filter: { valueFilter: KeyValueTypleValueFilter.NULL } });
 * // { a: 1 }
 * ```
 */
export function filterFromPOJO<T extends object>(obj: T, config: FilterFromPOJO<T> = {}): T {
  return filterFromPOJOFunction<T>(config)(obj);
}

/**
 * Function that removes filtered values from an input object.
 * Accepts an optional `copyOverride` parameter to control copy behavior per-call.
 */
export type FilterFromPOJOFunction<T> = (input: T, copyOverride?: Maybe<boolean>) => T;

/**
 * Generic version of {@link FilterFromPOJOFunction} that accepts any object type.
 */
export type GeneralFilterFromPOJOFunction<X = object> = <T extends X>(input: T) => T;

/**
 * Creates a reusable {@link FilterFromPOJOFunction} with a pre-configured filter and copy behavior.
 *
 * The returned function removes key/value pairs that match the filter from the input object.
 * Internally, the filter is inverted so that matching values are deleted while non-matching values are retained.
 *
 * By default, removes `undefined` values (`KeyValueTypleValueFilter.UNDEFINED`) and does not copy (`copy: false`).
 *
 * @param config - Configuration for filtering and copying. Defaults to `{ copy: false, filter: { valueFilter: KeyValueTypleValueFilter.UNDEFINED } }`.
 * @param config.copy - when true, returns a shallow copy with filtered keys removed instead of mutating the input; defaults to false
 * @param config.filter - the filter criteria determining which key/value pairs to remove; defaults to removing `undefined` values
 * @returns A reusable filter function. The returned function also accepts a `copyOverride` argument to override the copy behavior per-call.
 *
 * @example
 * ```typescript
 * // Default: removes undefined values, mutates in place
 * const filterUndef = filterFromPOJOFunction();
 * const obj = { a: 1, b: undefined };
 * filterUndef(obj); // obj is now { a: 1 }
 *
 * // With copy and null filter:
 * const filterNulls = filterFromPOJOFunction({ copy: true, filter: { valueFilter: KeyValueTypleValueFilter.NULL } });
 * const result = filterNulls({ a: 1, b: null, c: undefined });
 * // result is { a: 1 }, original is unchanged
 * ```
 */
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
 * Pre-built {@link FilterFromPOJOFunction} that removes `undefined` values by mutating the input object (no copy).
 *
 * Used internally as the default filter for {@link overrideInObjectFunctionFactory} when no filter is provided.
 *
 * @example
 * ```typescript
 * const obj = { a: 1, b: undefined };
 * defaultFilterFromPOJOFunctionNoCopy(obj);
 * // obj is now { a: 1 }
 * ```
 */
export const defaultFilterFromPOJOFunctionNoCopy: FilterFromPOJOFunction<object> = filterFromPOJOFunction({ copy: false });

// MARK: AssignValuesToPOJO
/**
 * Assigns filtered values from `obj` onto `target`.
 *
 * By default, only non-`undefined` values from `obj` are assigned, and a copy of `target` is returned (the original is not mutated).
 *
 * @param target - The object to assign values onto.
 * @param obj - The source object whose matching values will be assigned.
 * @param input - Optional filter/copy configuration. Defaults to `KeyValueTypleValueFilter.UNDEFINED` with `copy: true`.
 * @returns The target with values assigned (either a copy or the original, depending on configuration).
 *
 * @example
 * ```typescript
 * const target = { a: 1, b: 2 };
 * const result = assignValuesToPOJO(target, { a: 10, b: undefined });
 * // result is { a: 10, b: 2 } (copy), target unchanged
 * ```
 */
export function assignValuesToPOJO<T extends object, K extends keyof T = keyof T>(target: T, obj: T, input?: AssignValuesToPOJOFunctionInput<T, K>): T {
  return assignValuesToPOJOFunction<T, K>(input)(target, obj);
}

/**
 * Overload that always returns a copy of the target with values assigned.
 */
export type AssignValuesToPOJOCopyFunction<T> = (target: T, obj: T, returnCopy: true) => T;

/**
 * Overload that mutates and returns the original target with values assigned.
 */
export type AssignValuesToPOJONoCopyFunction<T> = <I extends T>(target: I, obj: T, returnCopy: false) => I;

/**
 * Function that assigns filtered values from a source object onto a target object.
 *
 * Accepts an optional third argument `returnCopy` to override the default copy behavior per-call.
 * The `_returnCopyByDefault` property indicates the configured default copy behavior.
 */
export type AssignValuesToPOJOFunction<T> = ((target: T, obj: T, returnCopy?: boolean) => T) &
  AssignValuesToPOJOCopyFunction<T> &
  AssignValuesToPOJONoCopyFunction<T> & {
    readonly _returnCopyByDefault: boolean;
  };

/**
 * Configuration for {@link assignValuesToPOJOFunction}.
 *
 * Can be a simple {@link KeyValueTypleValueFilter} enum value, or a {@link KeyValueTupleFilter} object
 * with an additional `copy` property. When a simple enum value is provided, `copy` defaults to `true`.
 */
export type AssignValuesToPOJOFunctionInput<T extends object = object, K extends keyof T = keyof T> =
  | KeyValueTypleValueFilter
  | (KeyValueTupleFilter<T, K> & {
      /**
       * Whether or not to copy the target object before assigning values, returning the new object.
       *
       * True by default.
       */
      copy?: boolean;
    });

/**
 * Creates a reusable {@link AssignValuesToPOJOFunction} with a pre-configured filter and copy behavior.
 *
 * The returned function assigns key/value pairs from a source object onto a target, skipping pairs
 * that are filtered out. By default, `undefined` values are filtered out (`KeyValueTypleValueFilter.UNDEFINED`)
 * and the target is copied before assignment (`copy: true`).
 *
 * @param input - Filter and copy configuration. Defaults to `KeyValueTypleValueFilter.UNDEFINED` (filter undefined, copy target).
 * @returns A reusable assign function with a `_returnCopyByDefault` property indicating the configured copy behavior.
 *
 * @example
 * ```typescript
 * // Default: filters undefined, returns a copy
 * const assign = assignValuesToPOJOFunction();
 * const target = { a: 1, b: 2 };
 * const result = assign(target, { a: 10, b: undefined });
 * // result is { a: 10, b: 2 }, target is unchanged
 *
 * // With NULL filter and no copy:
 * const assignNoNulls = assignValuesToPOJOFunction({ valueFilter: KeyValueTypleValueFilter.NULL, copy: false });
 * ```
 */
export function assignValuesToPOJOFunction<T extends object, K extends keyof T = keyof T>(input: AssignValuesToPOJOFunctionInput<T, K> = KeyValueTypleValueFilter.UNDEFINED): AssignValuesToPOJOFunction<T> {
  const filter: FilterKeyValueTuplesInput<T> = input;
  const copy = (typeof input === 'object' ? input.copy : true) ?? true;

  const assignEachValueToTarget = forEachKeyValueOnPOJOFunction<T, T>({
    filter,
    // eslint-disable-next-line @typescript-eslint/max-params
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
 * Extracts values from the POJO whose key/value pairs pass the given filter, returning them as an array.
 *
 * By default, only non-`undefined` values are included (`KeyValueTypleValueFilter.UNDEFINED`).
 *
 * @param target - The object to extract values from.
 * @param filter - A {@link FilterKeyValueTuplesInput} controlling which values are included. Defaults to `KeyValueTypleValueFilter.UNDEFINED`.
 * @returns Array of values whose key/value pairs passed the filter.
 *
 * @example
 * ```typescript
 * valuesFromPOJO({ a: 1, b: undefined, c: 'hello' });
 * // [1, 'hello']
 *
 * valuesFromPOJO({ a: 1, b: null, c: 'hello' }, KeyValueTypleValueFilter.NULL);
 * // [1, 'hello']  — null excluded
 * ```
 */
export function valuesFromPOJO<O = unknown, I extends object = object>(target: I, filter: FilterKeyValueTuplesInput<I> = KeyValueTypleValueFilter.UNDEFINED): O[] {
  return valuesFromPOJOFunction<O, I>(filter)(target);
}

type ValuesFromPOJOFunctionContext<O = unknown> = { values: O[] };

/**
 * Function that extracts values from a POJO whose key/value pairs pass a pre-configured filter.
 */
export type ValuesFromPOJOFunction<O = unknown, I extends object = object> = (obj: I) => O[];

/**
 * Creates a reusable {@link ValuesFromPOJOFunction} with a pre-configured filter.
 *
 * The returned function iterates each key/value pair on the input object, collects values
 * from pairs that pass the filter, and returns them as an array.
 *
 * By default, only non-`undefined` values are included (`KeyValueTypleValueFilter.UNDEFINED`).
 *
 * @param filter - A {@link FilterKeyValueTuplesInput} controlling which values are included. Defaults to `KeyValueTypleValueFilter.UNDEFINED`.
 * @returns A reusable function that extracts matching values from any input object.
 *
 * @example
 * ```typescript
 * const getDefinedValues = valuesFromPOJOFunction();
 * getDefinedValues({ a: 1, b: undefined, c: 'test' });
 * // [1, 'test']
 *
 * const getNonNullValues = valuesFromPOJOFunction(KeyValueTypleValueFilter.NULL);
 * getNonNullValues({ a: 1, b: null, c: undefined });
 * // [1]
 * ```
 */
export function valuesFromPOJOFunction<O = unknown, I extends object = object>(filter: FilterKeyValueTuplesInput<I> = KeyValueTypleValueFilter.UNDEFINED): ValuesFromPOJOFunction<O, I> {
  const addValuesFromObjectToContext = forEachKeyValueOnPOJOFunction<I, ValuesFromPOJOFunctionContext<O>>({
    filter,
    // eslint-disable-next-line @typescript-eslint/max-params
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
 * Creates a {@link FilterTuplesOnPOJOFunction} that retains only keys present in `keysToFilter`,
 * or excludes them if `invertFilter` is `true`.
 *
 * Always returns a new object (never mutates the input).
 *
 * @param keysToFilter - The set of keys to include (or exclude when inverted).
 * @param invertFilter - When `true`, keys in `keysToFilter` are excluded instead of included. Defaults to `false`.
 * @returns A function that filters keys on any input POJO.
 *
 * @example
 * ```typescript
 * const pickAB = filterKeysOnPOJOFunction(['a', 'b']);
 * pickAB({ a: 1, b: 2, c: 3 });
 * // { a: 1, b: 2 }
 *
 * const omitAB = filterKeysOnPOJOFunction(['a', 'b'], true);
 * omitAB({ a: 1, b: 2, c: 3 });
 * // { c: 3 }
 * ```
 */
export function filterKeysOnPOJOFunction<T extends object>(keysToFilter: Iterable<string>, invertFilter = false): FilterTuplesOnPOJOFunction<T> {
  const keysSet = new Set(keysToFilter);
  const filterFn = invertBooleanReturnFunction(([key]) => keysSet.has(key), invertFilter);
  return filterTuplesOnPOJOFunction(filterFn);
}

/**
 * Filter predicate type used with {@link Object.entries} to filter key/value pairs.
 */
export type FilterTuplesOnPOJOFilter<T extends object> = Parameters<ReturnType<typeof Object.entries<T>>['filter']>['0'];

/**
 * Function that returns a new object containing only the key/value pairs that pass a pre-configured filter.
 * For `Record<string, V>` types, returns `Record<string, V>`. For other object types, returns `Partial<T>`.
 */
export type FilterTuplesOnPOJOFunction<T extends object> = T extends Record<string, infer I> ? (input: T) => Record<string, I> : (input: T) => Partial<T>;

/**
 * Creates a {@link FilterTuplesOnPOJOFunction} from a raw entry filter predicate.
 *
 * The returned function iterates all entries of the input object, applies the predicate,
 * and returns a new object containing only the entries that pass.
 *
 * @param filterTupleOnObject - Predicate applied to each `[key, value]` entry.
 * @returns A function that filters entries on any input POJO.
 *
 * @example
 * ```typescript
 * const keepStrings = filterTuplesOnPOJOFunction(([, value]) => typeof value === 'string');
 * keepStrings({ a: 'hello', b: 42, c: 'world' });
 * // { a: 'hello', c: 'world' }
 * ```
 */
export function filterTuplesOnPOJOFunction<T extends object>(filterTupleOnObject: FilterTuplesOnPOJOFilter<T>): FilterTuplesOnPOJOFunction<T> {
  return ((input: T) => {
    const result: Partial<T> = {};

    Object.entries<T>(input as unknown as Record<string, T>)
      .filter(filterTupleOnObject)
      .forEach((tuple) => {
        (result as unknown as Record<string, unknown>)[tuple[0]] = tuple[1];
      });

    return result;
  }) as FilterTuplesOnPOJOFunction<T>;
}

// MARK: ForEachKeyValue
/**
 * Callback invoked for each matching key/value pair during iteration.
 *
 * @param tuple - The `[key, value]` pair.
 * @param index - The index of the tuple among filtered results.
 * @param object - The original object being iterated.
 * @param context - An optional context value passed through from the caller.
 */
// eslint-disable-next-line @typescript-eslint/max-params
export type ForEachKeyValueOnPOJOTupleFunction<T extends object, C = unknown, K extends keyof T = keyof T> = (tuple: KeyValueTuple<T, K>, index: number, object: T, context: C) => void;

/**
 * Function that iterates filtered key/value pairs on a POJO.
 * When context type `C` is `void`, no context argument is needed. Otherwise, a context must be provided.
 */
export type ForEachKeyValueOnPOJOFunction<T extends object, C = unknown> = C extends void ? ForEachKeyValueOnPOJOFunctionWithoutContext<T> : ForEachKeyValueOnPOJOFunctionWithContext<T, C>;

/**
 * Variant that takes only the object (no context).
 */
export type ForEachKeyValueOnPOJOFunctionWithoutContext<T extends object> = (object: T) => void;

/**
 * Variant that takes both the object and a context value.
 */
export type ForEachKeyValueOnPOJOFunctionWithContext<T extends object, C = unknown> = (object: T, context: C) => void;

/**
 * Configuration for {@link forEachKeyValueOnPOJOFunction}.
 */
export type ForEachKeyValueOnPOJOConfig<T extends object, C = unknown, K extends keyof T = keyof T> = {
  /**
   * Optional filter controlling which key/value pairs are iterated.
   * When not provided, all key/value pairs are iterated.
   */
  filter?: FilterKeyValueTuplesInput<T, K>;
  /**
   * Callback invoked for each matching key/value pair.
   */
  forEach: ForEachKeyValueOnPOJOTupleFunction<T, C, K>;
};

/**
 * Creates a reusable function that iterates over filtered key/value pairs of a POJO,
 * invoking a callback for each matching pair.
 *
 * This is the low-level building block used by {@link filterFromPOJOFunction}, {@link findPOJOKeysFunction},
 * {@link countPOJOKeysFunction}, {@link assignValuesToPOJOFunction}, and {@link valuesFromPOJOFunction}.
 *
 * When no filter is provided, all key/value pairs are iterated.
 *
 * @param config - The filter and forEach callback configuration.
 * @param config.forEach - callback invoked for each key/value pair that passes the filter
 * @param config.filter - optional filter controlling which key/value pairs are iterated; when omitted, all pairs are visited
 * @returns A function that iterates matching key/value pairs on any input object.
 *
 * @example
 * ```typescript
 * const logDefined = forEachKeyValueOnPOJOFunction<Record<string, unknown>, void>({
 *   filter: KeyValueTypleValueFilter.UNDEFINED,
 *   forEach: ([key, value]) => console.log(key, value)
 * });
 * logDefined({ a: 1, b: undefined, c: 'test' });
 * // logs: 'a' 1, 'c' 'test'
 * ```
 */
export function forEachKeyValueOnPOJOFunction<T extends object, C = unknown, K extends keyof T = keyof T>({ forEach, filter }: ForEachKeyValueOnPOJOConfig<T, C, K>): ForEachKeyValueOnPOJOFunction<T, C> {
  const filterKeyValues = filterKeyValueTuplesFunction<T, K>(filter);

  return ((obj: T, context: C) => {
    const keyValues = filterKeyValues(obj);
    keyValues.forEach((x, i) => forEach(x, i, obj, context));
  }) as ForEachKeyValueOnPOJOFunction<T, C>;
}
