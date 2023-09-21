import { DateCellIndex } from './date.cell';
import { DateScheduleDayCodesInput, expandDateScheduleDayCodes } from './date.schedule';

/**
 * Converts the input day codes into DateCellIndex values.
 *
 * @param dayCodes
 * @returns
 */
export function dateCellIndexsForDateScheduleDayCodes(sundayIndex: DateCellIndex, dayCodes: DateScheduleDayCodesInput): DateCellIndex[] {
  return expandDateScheduleDayCodes(dayCodes).map((x) => sundayIndex + x - 1);
}
