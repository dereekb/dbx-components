import { Building } from '@dereekb/util';
import { dateTimezoneUtcNormal, DateTimezoneUtcNormalFunctionInput, DateTimezoneUtcNormalInstance, DateTimezoneUtcNormalInstanceTransformType } from './date.timezone';
import { TransformDateRangeDatesFunction, transformDateRangeDatesFunction } from './date.range';

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
