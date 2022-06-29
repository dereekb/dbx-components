import { FilterFunction, invertFilter } from '../filter/filter';
import { KeyAsString } from '../type';
import { hasValueOrNotEmpty, hasValueOrNotEmptyObject } from '../value/maybe';

// MARK: For Each
export type ForEachKeyValueTupleFunction<T extends object = object, K extends keyof T = keyof T> = (tuple: KeyValueTuple<T, K>, index: number) => void;

export interface ForEachKeyValue<T extends object = object, K extends keyof T = keyof T> {
  filter?: FilterKeyValueTuplesInput<T, K>;
  forEach: ForEachKeyValueTupleFunction<T, K>;
}

export function forEachKeyValue<T extends object = object, K extends keyof T = keyof T>(obj: T, { forEach, filter }: ForEachKeyValue<T, K>): void {
  const keyValues = filterKeyValueTuples<T, K>(obj, filter);
  keyValues.forEach(forEach);
}

export function filterKeyValueTuples<T extends object = object, K extends keyof T = keyof T>(obj: T, filter?: FilterKeyValueTuplesInput<T, K>): KeyValueTuple<T, K>[] {
  return filterKeyValueTuplesFunction(filter)(obj);
}

// MARK: Tuples
/**
 * A Key-Value pair within an Tuple array value.
 */
export type KeyValueTuple<T extends object = object, K extends keyof T = keyof T> = [K, T[K]];

export type FilterKeyValueTuplesFunction<T extends object = object, K extends keyof T = keyof T> = (obj: T) => KeyValueTuple<T, K>[];

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

export function allKeyValueTuples<T extends object = object, K extends keyof T = keyof T>(obj: T): KeyValueTuple<T, K>[] {
  return Object.entries(obj) as KeyValueTuple<T, K>[];
}

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

export interface KeyValueTupleFilter<T extends object = object, K extends keyof T = keyof T> {
  valueFilter?: KeyValueTypleValueFilter;
  invertFilter?: boolean;
  keysFilter?: (K | KeyAsString<K>)[];
}

/**
 * Converts an input FilterKeyValueTuplesInput to a KeyValueTupleFilter.
 *
 * @param input
 * @returns
 */
export function filterKeyValueTuplesInputToFilter<T extends object = object, K extends keyof T = keyof T>(input: FilterKeyValueTuplesInput<T, K>): KeyValueTupleFilter<T, K> {
  if (typeof input === 'object') {
    return input;
  } else {
    return { valueFilter: input };
  }
}

export type FilterKeyValueTupleFunction<T extends object = object, K extends keyof T = keyof T> = FilterFunction<KeyValueTuple<T, K>>;

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
