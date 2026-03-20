import { exhaustMap, map, scan, shareReplay, startWith, distinctUntilChanged, type MonoTypeOperatorFunction, type Observable, type OperatorFunction, switchMap, combineLatest, of, first, type ObservableInput } from 'rxjs';
import { type Maybe, type ArrayOrValue, pushItemOrArrayItemsIntoArray, forEachWithArray, pushArrayItemsIntoArray, asArray, type MapFunction } from '@dereekb/util';

/**
 * `distinctUntilChanged` variant that only emits when the array length changes.
 *
 * Optionally accepts an accessor function to extract the array from a complex value.
 *
 * @param getArray - optional function to extract the array from the emitted value
 * @returns an operator that filters emissions with unchanged array lengths
 */
export function distinctUntilArrayLengthChanges<A>(getArray: (value: A) => unknown[]): MonoTypeOperatorFunction<A>;
export function distinctUntilArrayLengthChanges<T>(): MonoTypeOperatorFunction<T[]>;
export function distinctUntilArrayLengthChanges<A>(inputGetArray?: (value: A) => unknown[]): MonoTypeOperatorFunction<A> {
  const getArray = inputGetArray ?? ((value: A) => asArray(value));
  return distinctUntilChanged(
    (a, b) => a === b,
    (x) => getArray(x).length
  );
}

export interface ScanIntoArrayConfig {
  readonly immutable?: boolean;
}

/**
 * Accumulates emitted values into a growing array using `scan`.
 *
 * Each emission adds to the accumulated array. When `immutable` is true (default),
 * a new array is created on each emission via `concat`. When false, the array is mutated in place.
 *
 * @example
 * ```ts
 * of(1, 2, 3).pipe(
 *   scanIntoArray()
 * ).subscribe(console.log);
 * // [1], [1, 2], [1, 2, 3]
 * ```
 *
 * @param config - optional immutability setting
 * @returns an operator that accumulates values into an array
 */
export function scanIntoArray<T>(config?: ScanIntoArrayConfig): OperatorFunction<Maybe<ArrayOrValue<T>>, T[]>;
export function scanIntoArray<T>(config?: ScanIntoArrayConfig): OperatorFunction<Maybe<T>, T[]>;
export function scanIntoArray<T>(config?: ScanIntoArrayConfig): OperatorFunction<Maybe<T[]>, T[]>;
export function scanIntoArray<T>(config: { immutable?: boolean } = {}): OperatorFunction<Maybe<ArrayOrValue<T>>, T[]> {
  const { immutable = true } = config;
  return scan((acc: T[], next: Maybe<ArrayOrValue<T>>) => {
    if (next != null) {
      if (immutable) {
        acc = [...acc, ...asArray(next)];
      } else {
        acc = pushItemOrArrayItemsIntoArray(acc, next);
      }
    }

    return acc;
  }, []);
}

// MARK: ScanBuildArray
export interface ScanBuildArrayConfig<T> {
  /**
   *
   */
  readonly seed?: Maybe<T[]>;
  /**
   *
   */
  readonly accumulatorObs: Observable<Maybe<ArrayOrValue<T>>>;
  /**
   * Whether or not to flatten array values that are input.
   */
  readonly flattenArray?: boolean;
}

export type ScanBuildArrayConfigFn<S, T> = (seedState: S) => ScanBuildArrayConfig<T>;

/**
 * Lazily builds an array from a seed observable and an accumulator observable.
 *
 * The piped observable provides the seed state, while `accumulatorObs` provides values that
 * are incrementally appended. Useful when loading large datasets where the initial page and
 * subsequent pages come from different sources.
 *
 * @param init - function that receives the seed state and returns the accumulator config
 * @returns an operator that emits the growing array
 */
export function scanBuildArray<S, T>(init: ScanBuildArrayConfigFn<S, T>): OperatorFunction<S, T[]> {
  return exhaustMap((seedState: S) => {
    const { seed = [], accumulatorObs, flattenArray = false } = init(seedState);

    return accumulatorObs.pipe(
      startWith<Maybe<ArrayOrValue<T>>>(undefined), // use startWith to not wait for the accumulator to pass a value.
      scan<Maybe<ArrayOrValue<T>>, T[]>((acc: T[], next: Maybe<ArrayOrValue<T>>) => {
        if (next != null) {
          if (flattenArray && Array.isArray(next)) {
            pushArrayItemsIntoArray(acc, next);
          } else {
            acc.push(next as T);
          }
        }

        return acc;
      }, seed ?? []),
      distinctUntilArrayLengthChanges(),
      map((x) => [...x]), // always create a copy of the accumulated array when emitting
      shareReplay(1)
    );
  });
}

// MARK: MapForEach
/**
 * RxJS operator that executes a side-effect on each element of the emitted array, then passes the array through.
 *
 * @param forEach - callback to run for each element, or null/undefined to pass through unchanged
 * @returns an operator that taps each element in emitted arrays
 */
export function mapForEach<T>(forEach: Maybe<(value: T) => void>): MonoTypeOperatorFunction<T[]> {
  return forEach ? map((x) => forEachWithArray(x, forEach)) : map((x) => x);
}

// MARK: MapEachAsync
export interface MapEachAsyncConfig {
  /**
   * Whether or not to map only the first
   */
  readonly onlyFirst?: boolean;
}

/**
 * RxJS operator that maps each element in an emitted array through an async observable function,
 * then combines all results using `combineLatest`.
 *
 * Emits `[]` for empty arrays. When `onlyFirst` is true, takes only the first combined emission.
 *
 * @param mapFunction - function that maps each item to an ObservableInput
 * @param config - optional config (e.g., `onlyFirst`)
 * @returns an operator that async-maps each array element
 */
export function mapEachAsync<I, O>(mapFunction: MapFunction<I, ObservableInput<O>>, config?: MapEachAsyncConfig): OperatorFunction<I[], O[]> {
  const { onlyFirst = false } = config ?? {};

  return switchMap((values: I[]) => {
    if (values.length) {
      const mappedObs = values.map(mapFunction);
      let result = combineLatest(mappedObs);

      if (onlyFirst) {
        result = result.pipe(first());
      }

      return result;
    } else {
      return of([]);
    }
  });
}
