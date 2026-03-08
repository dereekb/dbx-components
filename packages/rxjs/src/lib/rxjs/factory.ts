import { type FactoryWithInput } from '@dereekb/util';
import { takeWhile, map, type Observable, timer } from 'rxjs';

/**
 * factoryTimer() configuration
 */
export interface FactoryTimerConfig<T> {
  /**
   * How long to wait before the first emission.
   */
  wait?: number;

  /**
   * Interval period
   */
  interval?: number;

  /**
   * Max number of iterations.
   */
  limit?: number;

  /**
   * Factory for values.
   */
  factory: FactoryWithInput<T, number>;
}

export const DEFAULT_FACTORY_TIMER_INTERVAL = 1000;

/**
 * Creates an observable that emits values produced by a factory function on a timer interval.
 *
 * Wraps `timer()` internally and maps each tick index through the factory. Optionally limits
 * the total number of emissions.
 *
 * @example
 * ```ts
 * const countdown$ = factoryTimer({
 *   factory: (i) => 10 - i,
 *   interval: 1000,
 *   limit: 11
 * });
 * // emits 10, 9, 8, ... 0
 * ```
 *
 * @param config - timer configuration including factory, interval, wait, and limit
 * @returns an observable of factory-produced values
 */
export function factoryTimer<T>(config: FactoryTimerConfig<T>): Observable<T> {
  const { wait = 0, interval = DEFAULT_FACTORY_TIMER_INTERVAL, limit, factory } = config;
  let obs = timer(wait, interval);

  if (limit) {
    obs = obs.pipe(takeWhile((x) => x < limit));
  }

  return obs.pipe(map((i) => factory(i)));
}
