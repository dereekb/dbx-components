import { incrementingNumberFactory, type IncrementingNumberFactoryConfig } from '@dereekb/util';
import { scan, type Observable, type OperatorFunction } from 'rxjs';
import { factoryTimer, type FactoryTimerConfig } from './factory';

/**
 * RxJS operator that counts emissions as they occur using `scan`, emitting the running count
 * after each emission (unlike `count()` which only emits on completion).
 *
 * @param startAt - Initial count value (defaults to 0)
 * @returns An operator that emits the running emission count.
 */
export function scanCount(startAt = 0): OperatorFunction<unknown, number> {
  return scan((count) => count + 1, startAt);
}

/**
 * incrementingNumberTimer() configuration
 */
export interface IncrementingTimerConfig extends Omit<FactoryTimerConfig<number>, 'factory'>, IncrementingNumberFactoryConfig {}

/**
 * Creates a {@link factoryTimer} that emits incrementing numbers on an interval.
 *
 * @param config - Timer and incrementing number configuration.
 * @returns An observable of incrementing numbers.
 */
export function incrementingNumberTimer(config: IncrementingTimerConfig = {}): Observable<number> {
  return factoryTimer({
    ...config,
    factory: incrementingNumberFactory(config)
  });
}
