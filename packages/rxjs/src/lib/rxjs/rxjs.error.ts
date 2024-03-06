import { Factory, Maybe, Milliseconds, timePeriodCounter } from '@dereekb/util';
import { MonoTypeOperatorFunction, Observable, map, of, switchMap } from 'rxjs';

export interface ErrorOnEmissionsInPeriodConfig<T> {
  /**
   * Number of milliseconds before clearing the emission count.
   *
   * Defaults to 1000 ms
   */
  readonly period?: Milliseconds;
  /**
   * The number of max emissions to allow.
   */
  readonly maxEmissionsPerPeriod: number;
  /**
   * Called before the error is thrown.
   *
   * @returns
   */
  readonly onError?: (error: unknown) => void;
  /**
   * Factory used to generate a new error to pass to the observable.
   *
   * If not provided, and switchToObs is not provided, a default error is thrown.
   */
  readonly errorFactory?: Factory<unknown>;
  /**
   * Optional observable to switch to instead of throwing an error.
   *
   * If errorFactory is provided this is ignored.
   */
  readonly switchToObs?: Observable<T>;
  /**
   * Optional error message to use instead of using ErrorFactory.
   *
   * If switchToObs is provided this is ignored.
   */
  readonly errorMessage?: string;
}

export function errorOnEmissionsInPeriod<T>(config: ErrorOnEmissionsInPeriodConfig<T>): MonoTypeOperatorFunction<T> {
  const { period = 1000, maxEmissionsPerPeriod, onError, errorFactory: inputErrorFactory, errorMessage: inputErrorMessage, switchToObs } = config;
  const errorMessage = inputErrorMessage ?? 'errorOnEmissionsInPeriod(): Too many emissions in time period.';
  const errorFactory = inputErrorFactory ? inputErrorFactory : !switchToObs ? () => new Error(errorMessage) : undefined;

  return (source: Observable<T>) => {
    const counter = timePeriodCounter(period);

    if (errorFactory) {
      return source.pipe(
        map((x) => {
          if (counter() > maxEmissionsPerPeriod) {
            const error = errorFactory();
            onError?.(error);
            throw error;
          } else {
            return x;
          }
        })
      );
    } else {
      // switchToObs was provided.
      return source.pipe(
        switchMap((x) => {
          if (counter() > maxEmissionsPerPeriod) {
            return switchToObs as Observable<T>;
          } else {
            return of(x);
          }
        })
      );
    }
  };
}
