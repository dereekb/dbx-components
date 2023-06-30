import { exhaustMap, map, scan, shareReplay, startWith, distinctUntilChanged, MonoTypeOperatorFunction, Observable, OperatorFunction, switchMap, combineLatest, of, first, ObservableInput } from 'rxjs';
import { Maybe, ArrayOrValue, mergeArrayOrValueIntoArray, forEachWithArray, mergeArrayIntoArray, asArray, MapFunction } from '@dereekb/util';

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
  immutable?: boolean;
}

/**
 * Scans values from the observable into an array.
 *
 * Can configure whether or not the accumulator array is immutable or not.
 */
export function scanIntoArray<T>(config?: ScanIntoArrayConfig): OperatorFunction<Maybe<ArrayOrValue<T>>, T[]>;
export function scanIntoArray<T>(config?: ScanIntoArrayConfig): OperatorFunction<Maybe<T>, T[]>;
export function scanIntoArray<T>(config?: ScanIntoArrayConfig): OperatorFunction<Maybe<T[]>, T[]>;
export function scanIntoArray<T>(config: { immutable?: boolean } = {}): OperatorFunction<Maybe<ArrayOrValue<T>>, T[]> {
  const { immutable = true } = config;
  return scan((acc: T[], next: Maybe<ArrayOrValue<T>>) => {
    if (next != null) {
      if (immutable) {
        acc = acc.concat(next);
      } else {
        acc = mergeArrayOrValueIntoArray(acc, next);
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
  seed?: Maybe<T[]>;
  /**
   *
   */
  accumulatorObs: Observable<Maybe<ArrayOrValue<T>>>;
  /**
   * Whether or not to flatten array values that are input.
   */
  flattenArray?: boolean;
}

export type ScanBuildArrayConfigFn<S, T> = (seedState: S) => ScanBuildArrayConfig<T>;

/**
 * Used to lazy build an array from two observables.
 *
 * The piped observable is for retrieving the seed value, and the accumulatorObs observable is used for
 * retrieving values going forward.
 *
 * This is useful in cases where values are very large.
 *
 * @param param0
 * @returns
 */
export function scanBuildArray<S, T>(init: ScanBuildArrayConfigFn<S, T>): OperatorFunction<S, T[]> {
  return exhaustMap((seedState: S) => {
    const { seed = [], accumulatorObs, flattenArray = false } = init(seedState);

    return accumulatorObs.pipe(
      startWith<Maybe<ArrayOrValue<T>>>(undefined), // use startWith to not wait for the accumulator to pass a value.
      scan<Maybe<ArrayOrValue<T>>, T[]>((acc: T[], next: Maybe<ArrayOrValue<T>>) => {
        if (next != null) {
          if (flattenArray && Array.isArray(next)) {
            mergeArrayIntoArray(acc, next);
          } else {
            acc.push(next as T);
          }
        }

        return acc;
      }, seed ?? []),
      distinctUntilArrayLengthChanges(),
      shareReplay(1)
    );
  });
}

// MARK: MapForEach
/**
 * Convenience function that calls forEachWithArray() and returns the original array.
 *
 * @param forEach
 * @returns
 */
export function mapForEach<T>(forEach: Maybe<(value: T) => void>): MonoTypeOperatorFunction<T[]> {
  return forEach ? map((x) => forEachWithArray(x, forEach)) : map((x) => x);
}

// MARK: MapEachAsync
export interface MapEachAsyncConfig {
  /**
   * Whether or not to map only the first
   */
  onlyFirst?: boolean;
}

/**
 * Operator function that maps each value in the array independently using Observables, then combines the all results.
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
