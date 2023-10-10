import { Building } from '@dereekb/util';
import { DateTimezoneUtcNormalFunctionInput, DateTimezoneUtcNormalInstance, transformDateRangeInTimezoneNormalFunction } from './date.timezone';
import { DateRange, fitUTCDateRangeToDayPeriod } from './date.range';

/**
 * Modifies the input DateRange to fit within a 24 hour period.
 *
 * I.E. 12:00AM 1/1/2020 to 12:00PM 1/4/2020 becomes 12:00AM 1/1/2020 to 12:00PM 1/1/2020
 */
export type FitDateRangeToDayPeriodFunction = (<T extends DateRange>(dateRange: T) => T) & {
  readonly _timezoneInstance: DateTimezoneUtcNormalInstance;
};

/**
 * Creates a FitDateRangeToDayPeriodFunction
 *
 * @param timezone
 * @returns
 */
export function fitDateRangeToDayPeriodFunction(timezone: DateTimezoneUtcNormalFunctionInput): FitDateRangeToDayPeriodFunction {
  const transformFn = transformDateRangeInTimezoneNormalFunction(timezone, 'baseDateToTargetDate');
  const fn = (<T extends DateRange>(input: T) => ({ ...input, ...transformFn(input, fitUTCDateRangeToDayPeriod) })) as Building<FitDateRangeToDayPeriodFunction>;
  fn._timezoneInstance = transformFn._timezoneInstance;
  return fn as FitDateRangeToDayPeriodFunction;
}

/**
 * Fits the DateRange to a single "day" period from the start time.
 *
 * @param dateRange
 * @param timezone
 */
export function fitDateRangeToDayPeriod<T extends DateRange = DateRange>(dateRange: T, timezone: DateTimezoneUtcNormalFunctionInput): T;
/**
 * @deprecated Provide a timezone to properly handle daylight savings changes, or use fitUTCDateRangeToDayPeriod() explicitly.
 *
 * @param dateRange
 * @param timezone
 */
export function fitDateRangeToDayPeriod<T extends DateRange = DateRange>(dateRange: T, timezone?: DateTimezoneUtcNormalFunctionInput): T;
export function fitDateRangeToDayPeriod<T extends DateRange = DateRange>(dateRange: T, timezone?: DateTimezoneUtcNormalFunctionInput): T {
  if (timezone) {
    return fitDateRangeToDayPeriodFunction(timezone)(dateRange);
  } else {
    return fitUTCDateRangeToDayPeriod(dateRange);
  }
}
