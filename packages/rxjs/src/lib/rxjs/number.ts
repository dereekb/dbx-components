import { incrementingNumberFactory, IncrementingNumberFactoryConfig } from '@dereekb/util';
import { Observable } from 'rxjs';
import { OperatorFunction } from 'rxjs';
import { scan } from 'rxjs/operators';
import { factoryTimer, FactoryTimerConfig } from './factory';

/**
 * Similar to count(), but counts emissions as they occur using scan.
 */
export function scanCount(startAt = 0): OperatorFunction<any, number> {
  return scan((count, _) => count + 1, startAt);
}


/**
 * incrementingNumberTimer() configuration
 */
export interface IncrementingTimerConfig extends Omit<FactoryTimerConfig<number>, 'factory'>, IncrementingNumberFactoryConfig { }

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
