import { type Building } from '@dereekb/util';
import { type DateTimezoneUtcNormalFunctionInput, type DateTimezoneUtcNormalInstance, transformDateRangeInTimezoneNormalFunction } from './date.timezone';
import { type DateRange, fitUTCDateRangeToDayPeriod } from './date.range';

/**
 * Modifies the input DateRange to fit within a 24 hour period.
 *
 * I.E. 12:00AM 1/1/2020 to 12:00PM 1/4/2020 becomes 12:00AM 1/1/2020 to 12:00PM 1/1/2020
 */
export type FitDateRangeToDayPeriodFunction = (<T extends DateRange>(dateRange: T) => T) & {
  readonly _timezoneInstance: DateTimezoneUtcNormalInstance;
};

/**
 * Creates a {@link FitDateRangeToDayPeriodFunction} that collapses a multi-day date range into a single-day period within the given timezone.
 *
 * The function first normalizes the range into the target timezone, fits it to a 24-hour period, then converts back.
 *
 * @param timezone - the timezone to use for the day period calculation
 * @returns a function that fits any date range to a single day period
 *
 * @example
 * ```ts
 * const fit = fitDateRangeToDayPeriodFunction('America/Chicago');
 * const range = { start: new Date('2024-01-01T10:00:00Z'), end: new Date('2024-01-03T14:00:00Z') };
 * const fitted = fit(range);
 * // fitted spans from 10:00 to 14:00 on the same day (4 hours)
 * ```
 */
export function fitDateRangeToDayPeriodFunction(timezone: DateTimezoneUtcNormalFunctionInput): FitDateRangeToDayPeriodFunction {
  const transformFn = transformDateRangeInTimezoneNormalFunction(timezone, 'baseDateToTargetDate');
  const fn = (<T extends DateRange>(input: T) => ({ ...input, ...transformFn(input, fitUTCDateRangeToDayPeriod) })) as Building<FitDateRangeToDayPeriodFunction>;
  fn._timezoneInstance = transformFn._timezoneInstance;
  return fn as FitDateRangeToDayPeriodFunction;
}

/**
 * Fits the DateRange to a single "day" period from the start time within the given timezone.
 *
 * Convenience wrapper around {@link fitDateRangeToDayPeriodFunction}.
 *
 * @param dateRange - the range to fit
 * @param timezone - the timezone for day boundary calculation
 */
export function fitDateRangeToDayPeriod<T extends DateRange = DateRange>(dateRange: T, timezone: DateTimezoneUtcNormalFunctionInput): T {
  return fitDateRangeToDayPeriodFunction(timezone)(dateRange);
}
