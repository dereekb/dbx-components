import { Building } from '@dereekb/util';
import { dateTimezoneUtcNormal, DateTimezoneUtcNormalFunctionInput, DateTimezoneUtcNormalInstance, DateTimezoneUtcNormalInstanceTransformType, inverseDateTimezoneUtcNormalInstanceTransformType } from './date.timezone';
import { DateRange, fitUTCDateRangeToDayPeriod, TransformDateRangeDatesFunction, transformDateRangeDatesFunction } from './date.range';

/**
 * Transforms the start and end dates in a date range to a specific timezone
 */
export type TransformDateRangeToTimezoneFunction = TransformDateRangeDatesFunction & {
  readonly _timezoneInstance: DateTimezoneUtcNormalInstance;
  readonly _transformType: DateTimezoneUtcNormalInstanceTransformType;
};

export function transformDateRangeToTimezoneFunction(timezoneInput: DateTimezoneUtcNormalFunctionInput, transformType: DateTimezoneUtcNormalInstanceTransformType = 'systemDateToTargetDate'): TransformDateRangeToTimezoneFunction {
  const timezoneInstance = dateTimezoneUtcNormal(timezoneInput);
  const fn = transformDateRangeDatesFunction(timezoneInstance.transformFunction(transformType)) as Building<TransformDateRangeToTimezoneFunction>;
  fn._timezoneInstance = timezoneInstance;
  fn._transformType = transformType;
  return fn as TransformDateRangeToTimezoneFunction;
}

/**
 * Transforms the start and end dates in a date range using a specific DateTimezoneUtcNormalInstanceTransformType type, processes a transformation in that normal, then reverses the result back to the original timezone.
 */
export type TransformDateRangeInTimezoneNormalFunction = ((dateRange: DateRange, transform: TransformDateRangeDatesFunction) => DateRange) & {
  readonly _timezoneInstance: DateTimezoneUtcNormalInstance;
  readonly _transformType: DateTimezoneUtcNormalInstanceTransformType;
};

export function transformDateRangeInTimezoneNormalFunction(timezoneInput: DateTimezoneUtcNormalFunctionInput, transformType: DateTimezoneUtcNormalInstanceTransformType = 'systemDateToTargetDate'): TransformDateRangeInTimezoneNormalFunction {
  const timezoneInstance = dateTimezoneUtcNormal(timezoneInput);
  const transformToNormal = transformDateRangeDatesFunction(timezoneInstance.transformFunction(transformType));
  const transformFromNormal = transformDateRangeDatesFunction(timezoneInstance.transformFunction(inverseDateTimezoneUtcNormalInstanceTransformType(transformType)));

  const fn = ((inputRange: DateRange, transform: TransformDateRangeDatesFunction) => {
    const inputNormal = transformToNormal(inputRange);
    const normalResult = transform(inputNormal);
    return transformFromNormal(normalResult);
  }) as Building<TransformDateRangeToTimezoneFunction>;

  fn._timezoneInstance = timezoneInstance;
  fn._transformType = transformType;
  return fn as TransformDateRangeToTimezoneFunction;
}

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
