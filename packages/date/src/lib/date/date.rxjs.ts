import { FactoryWithRequiredInput, IndexNumber, Maybe, Milliseconds, MS_IN_SECOND, protectedFactory } from '@dereekb/util';
import { distinctUntilChanged, interval, map, Observable, SchedulerLike, startWith } from 'rxjs';
import { isSameDate } from './date';
import { LogicalDateStringCode, logicalDateStringCodeDateFactory } from './date.logical';

export interface DateIntervalConfig {
  /**
   * How often to emit the date.
   *
   * Defaults to every second.
   */
  readonly period?: Maybe<Milliseconds>;
  /**
   * Emits the given logical each interval.
   */
  readonly logicalDate?: Maybe<LogicalDateStringCode>;
  /**
   * Factory to use for the date.
   */
  readonly factory?: FactoryWithRequiredInput<Date, IndexNumber>;
  /**
   * Whether or not to only emit each value and not only when the date has changed. False by default.
   */
  readonly emitAll?: boolean;
  /**
   * Scheduler for the rxjs interval.
   */
  readonly scheduler?: SchedulerLike | undefined;
}

/**
 * Creates an Observable that emits a date given the configuration.
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
 * Convenience function for dateInterval that returns the "now" logicalDate with an optional custom period.
 *
 * @param period
 * @returns
 */
export function nowInterval(period?: Maybe<Milliseconds>): Observable<Date> {
  return dateInterval({
    period,
    logicalDate: 'now',
    emitAll: true // no need to filter on emitting since now will be different each time
  });
}
