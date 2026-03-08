import { type FilterFunction, invertFilter } from '../filter/filter';
import { type KeyAsString } from '../type';
import { hasValueOrNotEmpty, hasValueOrNotEmptyObject } from '../value/maybe';

// MARK: For Each
/**
 * Callback invoked for each key/value tuple during iteration.
 */
export type ForEachKeyValueTupleFunction<T extends object = object, K extends keyof T = keyof T> = (tuple: KeyValueTuple<T, K>, index: number) => void;

/**
 * Configuration for {@link forEachKeyValue} specifying a filter and a forEach callback.
 */
export interface ForEachKeyValue<T extends object = object, K extends keyof T = keyof T> {
  readonly filter?: FilterKeyValueTuplesInput<T, K>;
  readonly forEach: ForEachKeyValueTupleFunction<T, K>;
}

/**
 * Iterates over filtered key/value tuples of an object and invokes a callback for each.
 *
 * @param obj - Object to iterate
 * @param config - Configuration with a forEach callback and optional filter
 *
 * @example
 * ```ts
 * const keys: string[] = [];
 * forEachKeyValue({ a: 1, b: undefined, c: 3 }, {
 *   filter: KeyValueTypleValueFilter.UNDEFINED,
 *   forEach: ([key]) => keys.push(key as string)
 * });
 * // keys: ['a', 'c']
 * ```
 */
export function forEachKeyValue<T extends object = object, K extends keyof T = keyof T>(obj: T, { forEach, filter }: ForEachKeyValue<T, K>): void {
  const keyValues = filterKeyValueTuples<T, K>(obj, filter);
  keyValues.forEach(forEach);
}

/**
 * Extracts key/value tuples from an object, optionally filtering them.
 *
 * @param obj - Object to extract tuples from
 * @param filter - Optional filter to apply to the tuples
 * @returns Array of matching key/value tuples
 *
 * @example
 * ```ts
 * const tuples = filterKeyValueTuples({ a: 1, b: null, c: 3 }, KeyValueTypleValueFilter.NULL);
 * // tuples: [['a', 1], ['c', 3]]
 * ```
 */
export function filterKeyValueTuples<T extends object = object, K extends keyof T = keyof T>(obj: T, filter?: FilterKeyValueTuplesInput<T, K>): KeyValueTuple<T, K>[] {
  return filterKeyValueTuplesFunction(filter)(obj);
}

// MARK: Tuples
/**
 * A Key-Value pair within an Tuple array value.
 */
export type KeyValueTuple<T extends object = object, K extends keyof T = keyof T> = [K, T[K]];

/**
 * Function that extracts key/value tuples from an object, optionally filtering them based on a pre-configured filter.
 */
export type FilterKeyValueTuplesFunction<T extends object = object, K extends keyof T = keyof T> = (obj: T) => KeyValueTuple<T, K>[];

/**
 * Creates a reusable function that extracts and filters key/value tuples from objects.
 *
 * When no filter is provided, returns all key/value tuples.
 *
 * @param filter - Optional filter configuration
 * @returns A function that extracts filtered tuples from any input object
 *
 * @example
 * ```ts
 * const getDefinedTuples = filterKeyValueTuplesFunction(KeyValueTypleValueFilter.UNDEFINED);
 * const tuples = getDefinedTuples({ a: 1, b: undefined, c: 'hello' });
 * // tuples: [['a', 1], ['c', 'hello']]
 * ```
 */
export function filterKeyValueTuplesFunction<T extends object = object, K extends keyof T = keyof T>(filter?: FilterKeyValueTuplesInput<T, K>): FilterKeyValueTuplesFunction<T, K> {
  if (filter != null) {
    const filterFn = filterKeyValueTupleFunction<T, K>(filter);

    return (obj: T) => {
      return (allKeyValueTuples(obj) as KeyValueTuple<T, K>[]).filter(filterFn);
    };
  } else {
    return allKeyValueTuples;
  }
}

/**
 * Returns all key/value pairs from the object as tuples using `Object.entries`.
 *
 * @param obj - Object to extract tuples from
 * @returns Array of `[key, value]` tuples
 *
 * @example
 * ```ts
 * const tuples = allKeyValueTuples({ x: 10, y: 20 });
 * // tuples: [['x', 10], ['y', 20]]
 * ```
 */
export function allKeyValueTuples<T extends object = object, K extends keyof T = keyof T>(obj: T): KeyValueTuple<T, K>[] {
  return Object.entries(obj) as KeyValueTuple<T, K>[];
}

/**
 * Input for configuring key/value tuple filtering. Can be a {@link KeyValueTypleValueFilter} enum for simple cases
 * or a {@link KeyValueTupleFilter} object for more complex filtering (value type + key restriction + inversion).
 */
export type FilterKeyValueTuplesInput<T extends object = object, K extends keyof T = keyof T> = KeyValueTypleValueFilter | KeyValueTupleFilter<T, K>;

/**
 * Value filter options for filterKeyValueTupleFunction()
 */
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
  FALSY = 3,
  /**
   * All values that are empty.
   */
  EMPTY = 4,
  /**
   * All values that are empty. Objects that have no keys are considered empty too.
   */
  EMPTY_STRICT = 5,
  /**
   * All values that are falsy or empty.
   */
  FALSY_AND_EMPTY = 6,
  /**
   * All values that are falsy or empty or an empty objects.
   */
  FALSY_AND_EMPTY_STRICT = 7
}

/**
 * Full configuration for filtering key/value tuples, supporting value type filtering, key restriction, and inversion.
 */
export interface KeyValueTupleFilter<T extends object = object, K extends keyof T = keyof T> {
  /**
   * Type of value filtering to apply.
   */
  valueFilter?: KeyValueTypleValueFilter;
  /**
   * When `true`, inverts the filter so that only non-matching tuples are retained.
   */
  invertFilter?: boolean;
  /**
   * Restricts filtering to only these keys. Other keys are excluded from the result.
   */
  keysFilter?: (K | KeyAsString<K>)[];
}

/**
 * Normalizes a {@link FilterKeyValueTuplesInput} to a {@link KeyValueTupleFilter} object.
 *
 * If the input is already an object, returns it as-is. If it's an enum value, wraps it in a filter object.
 *
 * @param input - Enum value or filter object
 * @returns Normalized filter object
 */
export function filterKeyValueTuplesInputToFilter<T extends object = object, K extends keyof T = keyof T>(input: FilterKeyValueTuplesInput<T, K>): KeyValueTupleFilter<T, K> {
  if (typeof input === 'object') {
    return input;
  } else {
    return { valueFilter: input };
  }
}

/**
 * Predicate function that tests a single key/value tuple, returning `true` if it passes the filter.
 */
export type FilterKeyValueTupleFunction<T extends object = object, K extends keyof T = keyof T> = FilterFunction<KeyValueTuple<T, K>>;

/**
 * Creates a filter predicate function for key/value tuples based on the provided filter configuration.
 *
 * The predicate returns `true` for tuples whose values pass the configured filter. Supports value type filtering
 * (undefined, null, falsy, empty), key filtering, and inversion.
 *
 * @param inputFilter - Filter configuration (enum value or full config object)
 * @returns A predicate function that tests individual key/value tuples
 *
 * @example
 * ```ts
 * const isNotNull = filterKeyValueTupleFunction(KeyValueTypleValueFilter.NULL);
 * isNotNull(['a', 1], 0);    // true
 * isNotNull(['b', null], 0); // false
 * ```
 */
export function filterKeyValueTupleFunction<T extends object = object, K extends keyof T = keyof T>(inputFilter: FilterKeyValueTuplesInput<T, K>): FilterKeyValueTupleFunction<T, K> {
  const filter = filterKeyValueTuplesInputToFilter(inputFilter);
  const { valueFilter: type = KeyValueTypleValueFilter.UNDEFINED, invertFilter: inverseFilter = false, keysFilter }: KeyValueTupleFilter<T, K> = filter;

  let filterFn: FilterKeyValueTupleFunction<T, K>;

  switch (type) {
    case KeyValueTypleValueFilter.UNDEFINED:
      filterFn = ([, x]) => x !== undefined;
      break;
    case KeyValueTypleValueFilter.NULL:
      filterFn = ([, x]) => x != null;
      break;
    case KeyValueTypleValueFilter.FALSY:
      filterFn = ([, x]) => Boolean(x);
      break;
    case KeyValueTypleValueFilter.EMPTY:
      filterFn = ([, x]) => hasValueOrNotEmpty(x);
      break;
    case KeyValueTypleValueFilter.EMPTY_STRICT:
      filterFn = ([, x]) => hasValueOrNotEmptyObject(x);
      break;
    case KeyValueTypleValueFilter.FALSY_AND_EMPTY:
      filterFn = ([, x]) => Boolean(x) && hasValueOrNotEmpty(x);
      break;
    case KeyValueTypleValueFilter.FALSY_AND_EMPTY_STRICT:
      filterFn = ([, x]) => Boolean(x) && hasValueOrNotEmptyObject(x);
      break;
    case KeyValueTypleValueFilter.NONE:
    default:
      filterFn = () => true;
      break;
  }

  if (keysFilter) {
    const filterByTypeFn = filterFn as FilterKeyValueTupleFunction<T, K>;
    // convert all the input keys to strings for our set, as Object.entries will return only strings.
    const keysSet = new Set(keysFilter.map((x) => x.toString())) as Set<K>;
    filterFn = (x, i) => filterByTypeFn(x, i) && keysSet.has(x[0]);
  }

  return invertFilter<KeyValueTuple<T, K>, FilterKeyValueTupleFunction<T, K>>(filterFn, inverseFilter);
}
