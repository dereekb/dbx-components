import { filterAndMapFunction, type Milliseconds } from '@dereekb/util';
import { combineLatest, map, type MonoTypeOperatorFunction, type Observable, of, switchMap, throttleTime } from 'rxjs';

/**
 * Decision-like that takes in a value and returns an Observable with a boolean.
 */
export type ObservableDecisionFunction<T> = (value: T) => Observable<boolean>;

/**
 * Wraps an {@link ObservableDecisionFunction} to negate its boolean result.
 *
 * When `invert` is false, returns the original function unchanged.
 *
 * @param decisionFn - the decision function to invert
 * @param invert - whether to apply the inversion (defaults to true)
 * @returns the inverted (or original) decision function
 */
export function invertObservableDecision<F extends ObservableDecisionFunction<any>>(decisionFn: F, invert = true): F {
  return invert
    ? (((value: unknown) => {
        const obs: Observable<boolean> = decisionFn(value);
        return obs.pipe(map((x) => !x));
      }) as F)
    : decisionFn;
}

/**
 * RxJS operator that filters an emitted array by evaluating each item through an async {@link ObservableDecisionFunction}.
 *
 * Items where the decision returns true are kept; others are removed. Results are throttled
 * to prevent excessive re-emissions.
 *
 * @param observableDecisionFunction - async predicate to evaluate each item
 * @param throttle - throttle duration in ms (defaults to 20)
 * @returns an operator that async-filters array elements
 */
export function filterItemsWithObservableDecision<T>(observableDecisionFunction: ObservableDecisionFunction<T>, throttle: Milliseconds = 20): MonoTypeOperatorFunction<T[]> {
  const filterAndMap = filterAndMapFunction<[T, boolean], T>(
    (x) => x[1],
    (x) => x[0]
  );

  return switchMap((values: T[]) => {
    let obs: Observable<T[]>;

    if (values.length) {
      const valueObs = values.map((x) => observableDecisionFunction(x).pipe(map((y) => [x, y] as [T, boolean])));
      obs = combineLatest(valueObs).pipe(throttleTime(throttle, undefined, { leading: true, trailing: true }), map(filterAndMap));
    } else {
      obs = of([]);
    }

    return obs;
  });
}
