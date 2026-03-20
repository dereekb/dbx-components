import { map, type Observable, combineLatest, of, type OperatorFunction } from 'rxjs';
import { allKeyValueTuples, type Building, keyValueMapFactory, multiKeyValueMapFactory, type PrimativeKey, type ReadKeyFunction, type ReadMultipleKeysFunction } from '@dereekb/util';
import { asObservable } from './getter';

/**
 * Creates a function that takes a `Map` and combines the latest emissions from observables
 * created from each map value.
 *
 * @param mapToObs - function to transform each map value into an observable
 * @returns a function that converts a Map to a combined observable of results
 */
export function combineLatestFromMapValuesObsFn<T, O>(mapToObs: (value: T) => Observable<O>): (map: Map<unknown, T>) => Observable<O[]> {
  const combineArrayFn = combineLatestFromArrayObsFn(mapToObs);
  return (latestMap: Map<unknown, T>) => {
    const mapValues = [...latestMap].map((y) => y[1]);
    return combineArrayFn(mapValues);
  };
}

/**
 * Creates a function that takes an array of values, maps each to an observable, and combines their latest emissions.
 *
 * Returns `of([])` for empty arrays.
 *
 * @param mapToObs - function to transform each value into an observable
 * @returns a function that converts an array to a combined observable
 */
export function combineLatestFromArrayObsFn<T, O>(mapToObs: (value: T) => Observable<O>): (values: T[]) => Observable<O[]> {
  return (latest) => {
    const newObs = latest.map(mapToObs);
    return newObs.length ? combineLatest(newObs) : of([]);
  };
}

// MARK: Object Map
export type ObservableObjectMap = object;

export type ObservableObjectMapResult<T extends ObservableObjectMap> = {
  [K in keyof T]: T[K] extends Observable<infer O> ? O : T[K];
};

/**
 * Combines the latest values from an object of observables into a single observable of resolved values.
 *
 * Each key in the input object maps to an observable (or static value). The result observable
 * emits an object with the same keys, where each value is the latest emission from its source.
 *
 * @example
 * ```ts
 * const result$ = combineLatestFromObject({
 *   name: of('Alice'),
 *   age: of(30)
 * });
 * // emits { name: 'Alice', age: 30 }
 * ```
 *
 * @param objectMap - an object whose values are observables or static values
 * @returns an observable that emits the resolved object
 */
export function combineLatestFromObject<T extends ObservableObjectMap>(objectMap: T): Observable<ObservableObjectMapResult<T>> {
  const pairs = allKeyValueTuples(objectMap);
  const observables = pairs.map((x) => asObservable(x[1]).pipe(map((value) => [x[0], value] as [keyof T, unknown])));

  return combineLatest(observables).pipe(
    map((latestValues) => {
      const result: Building<ObservableObjectMapResult<T>> = {};

      latestValues.forEach(([key, value]) => {
        result[key] = value as any;
      });

      return result as ObservableObjectMapResult<T>;
    })
  );
}

// MARK: Keys Map
/**
 * RxJS operator that maps an array of items to a `Map<K, T>` using the provided key reader.
 *
 * @param read - function to extract the key from each item
 * @returns an operator that converts an array into a keyed Map
 */
export function keyValueMap<T, K extends PrimativeKey = PrimativeKey>(read: ReadKeyFunction<T, K>): OperatorFunction<T[], Map<K, T>> {
  return map(keyValueMapFactory(read));
}

/**
 * RxJS operator that maps an array of items to a `Map<K, T>` using a multi-key reader,
 * allowing each item to appear under multiple keys.
 *
 * @param read - function to extract multiple keys from each item
 * @returns an operator that converts an array into a multi-keyed Map
 */
export function multiKeyValueMap<T, K extends PrimativeKey = PrimativeKey>(read: ReadMultipleKeysFunction<T, K>): OperatorFunction<T[], Map<K, T>> {
  return map(multiKeyValueMapFactory(read));
}
