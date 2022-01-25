import { exhaustMap, scan, shareReplay, startWith } from 'rxjs/operators';
import { distinctUntilChanged, MonoTypeOperatorFunction, Observable, OperatorFunction } from "rxjs";
import { Maybe, ArrayOrValue, mergeArrayOrValueIntoArray } from '@dereekb/util';

export function distinctUntilArrayLengthChanges<A>(getArray: (value: A) => any[]): MonoTypeOperatorFunction<A>;
export function distinctUntilArrayLengthChanges<T>(): MonoTypeOperatorFunction<T[]>;
export function distinctUntilArrayLengthChanges<A>(getArray?: (value: A) => any[]): MonoTypeOperatorFunction<A> {
  if (!getArray) {
    getArray = (value: A) => value as any as any[]
  }

  return distinctUntilChanged((a, b) => a === b, (x) => getArray(x).length);
}


export interface ScanBuildArrayConfig<T> {
  seed?: Maybe<T[]>;
  accumulatorObs: Observable<Maybe<T>>;
};

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
    const { seed = [], accumulatorObs } = init(seedState);

    return accumulatorObs.pipe(
      startWith(undefined), // Start with to not wait for the accumulator to pass a value.
      scan((acc: T[], next: Maybe<ArrayOrValue<T>>) => {
        if (next != null) {
          mergeArrayOrValueIntoArray(acc, next);
        }

        return acc;
      }, seed),
      distinctUntilArrayLengthChanges(),
      shareReplay(1)
    );
  });
}
