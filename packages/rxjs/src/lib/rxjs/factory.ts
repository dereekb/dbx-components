import { FactoryWithInput } from '@dereekb/util';
import { takeWhile, map, Observable, timer } from 'rxjs';

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
 * Creates an observable that uses timer internally and maps values from the factory result.
 * 
 * @param config 
 * @returns 
 */
export function factoryTimer<T>(config: FactoryTimerConfig<T>): Observable<T> {
  const { wait = 0, interval = DEFAULT_FACTORY_TIMER_INTERVAL, limit, factory } = config;
  let obs = timer(wait, interval);

  if (limit) {
    obs = obs.pipe(takeWhile((x) => x < limit));
  }

  return obs.pipe(map((i) => factory(i)));
}
