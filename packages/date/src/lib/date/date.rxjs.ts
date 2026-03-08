import { type FactoryWithRequiredInput, type IndexNumber, type Maybe, type Milliseconds, MS_IN_SECOND, protectedFactory } from '@dereekb/util';
import { distinctUntilChanged, interval, map, type Observable, type SchedulerLike, startWith } from 'rxjs';
import { isSameDate } from './date';
import { type LogicalDateStringCode, logicalDateStringCodeDateFactory } from './date.logical';

/**
 * Configuration for creating a periodic date-emitting Observable.
 */
export interface DateIntervalConfig {
  /**
   * How often to emit the date.
   *
   * Defaults to every second.
   */
  readonly period?: Maybe<Milliseconds>;
  /**
   * Emits the given logical date each interval (e.g. 'now', 'today_start').
   */
  readonly logicalDate?: Maybe<LogicalDateStringCode>;
  /**
   * Custom factory to use for producing each date value.
   */
  readonly factory?: FactoryWithRequiredInput<Date, IndexNumber>;
  /**
   * Whether to emit every interval tick regardless of whether the date changed. False by default.
   */
  readonly emitAll?: boolean;
  /**
   * Scheduler for the rxjs interval.
   */
  readonly scheduler?: SchedulerLike | undefined;
}

/**
 * Creates an Observable that emits a Date at regular intervals based on the given configuration.
 *
 * By default emits the current time every second and deduplicates consecutive equal dates.
 *
 * @param config - interval and date generation configuration
 * @returns an Observable that emits Date values
 *
 * @example
 * ```ts
 * // Emit start-of-today every 5 seconds
 * const today$ = dateInterval({ logicalDate: 'today_start', period: 5000 });
 * ```
 */
export function dateInterval(config: DateIntervalConfig): Observable<Date> {
  const { period, logicalDate: inputLogicalDate, factory: inputFactory, emitAll, scheduler } = config;
  let logicalDate: Maybe<LogicalDateStringCode> = inputLogicalDate;

  if (!logicalDate && !inputFactory) {
    logicalDate = 'now';
  }

  const intervalPeriod = period ?? MS_IN_SECOND;
  const factory = inputFactory ? inputFactory : protectedFactory(logicalDateStringCodeDateFactory(logicalDate as LogicalDateStringCode));
  let obs = interval(intervalPeriod, scheduler).pipe(startWith(-1), map(factory));

  if (emitAll !== true) {
    obs = obs.pipe(distinctUntilChanged<Date>(isSameDate));
  }

  return obs;
}

/**
 * Convenience function for {@link dateInterval} that emits the current time at each interval tick.
 *
 * Unlike the default dateInterval, this always emits (no deduplication) since each "now" is unique.
 *
 * @param period - optional emission interval in milliseconds (defaults to 1 second)
 * @returns an Observable that emits the current Date
 *
 * @example
 * ```ts
 * const now$ = nowInterval(1000);
 * now$.subscribe((date) => console.log('Current time:', date));
 * ```
 */
export function nowInterval(period?: Maybe<Milliseconds>): Observable<Date> {
  return dateInterval({
    period,
    logicalDate: 'now',
    emitAll: true // no need to filter on emitting since now will be different each time
  });
}
