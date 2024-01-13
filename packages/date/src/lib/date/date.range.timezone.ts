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
export function fitDateRangeToDayPeriod<T extends DateRange = DateRange>(dateRange: T, timezone: DateTimezoneUtcNormalFunctionInput): T {
  return fitDateRangeToDayPeriodFunction(timezone)(dateRange);
}
