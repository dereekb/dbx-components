import { DateBlockIndex } from './date.block';
import { DateScheduleDayCodesInput, expandDateScheduleDayCodes } from './date.schedule';

/**
 * Converts the input day codes into DateBlockIndex values.
 *
 * @param dayCodes
 * @returns
 */
export function dateBlockIndexsForDateScheduleDayCodes(sundayIndex: DateBlockIndex, dayCodes: DateScheduleDayCodesInput): DateBlockIndex[] {
  return expandDateScheduleDayCodes(dayCodes).map((x) => sundayIndex + x - 1);
}
