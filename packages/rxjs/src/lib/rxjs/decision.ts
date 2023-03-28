import { filterAndMapFunction, Milliseconds } from '@dereekb/util';
import { combineLatest, map, MonoTypeOperatorFunction, Observable, of, switchMap, throttleTime } from 'rxjs';

/**
 * Decision-like that takes in a value and returns an Observable with a boolean.
 */
export type ObservableDecisionFunction<T> = (value: T) => Observable<boolean>;

/**
 * Used to invert an ObservableDecisionFunction's result.
 *
 * @param filterFn
 * @param invert whether or not to apply the inversion.
 * @returns
 */
export function invertObservableDecision<F extends ObservableDecisionFunction<any>>(decisionFn: F, invert = true): F {
  if (invert) {
    return ((value: any) => {
      const obs: Observable<boolean> = decisionFn(value);
      return obs.pipe(map((x) => !x));
    }) as F;
  } else {
    return decisionFn;
  }
}

/**
 * Operator function that uses SwitchMap and filters each of the input values using an ObservableDecisionFunction, and returns them as an array.
 *
 * @param observableDecisionFunction
 * @returns
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
