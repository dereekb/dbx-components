import { ArrayOrValue, asArray } from '@dereekb/util';
import { DateBlockIndex } from './date.block';
import { DateScheduleDayCode, dateScheduleDayCodes, DateScheduleDayCodesInput, DateScheduleEncodedWeek } from './date.schedule';

/**
 * Converts the input day codes into DateBlockIndex values.
 *
 * @param dayCodes
 * @returns
 */
export function dateBlockIndexsForDateScheduleDayCodes(sundayIndex: DateBlockIndex, dayCodes: DateScheduleDayCodesInput): DateBlockIndex[] {
  return dateScheduleDayCodes(dayCodes).map((x) => sundayIndex + x - 1);
}
