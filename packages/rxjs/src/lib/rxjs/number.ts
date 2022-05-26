import { incrementingNumberFactory, IncrementingNumberFactoryConfig } from '@dereekb/util';
import { scan, Observable, OperatorFunction } from 'rxjs';
import { factoryTimer, FactoryTimerConfig } from './factory';

/**
 * Similar to count(), but counts emissions as they occur using scan.
 */
export function scanCount(startAt = 0): OperatorFunction<unknown, number> {
  return scan((count) => count + 1, startAt);
}

/**
 * incrementingNumberTimer() configuration
 */
export interface IncrementingTimerConfig extends Omit<FactoryTimerConfig<number>, 'factory'>, IncrementingNumberFactoryConfig {}

/**
 * Creates a factoryTimer for incrementing numbers.
 *
 * @param config
 * @returns
 */
export function incrementingNumberTimer(config: IncrementingTimerConfig = {}): Observable<number> {
  return factoryTimer({
    ...config,
    factory: incrementingNumberFactory(config)
  });
}
