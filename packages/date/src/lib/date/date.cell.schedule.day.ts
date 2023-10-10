import { DateCellIndex } from './date.cell';
import { DateCellScheduleDayCodesInput, expandDateCellScheduleDayCodes } from './date.cell.schedule';

/**
 * Converts the input day codes into DateCellIndex values.
 *
 * @param dayCodes
 * @returns
 */
export function dateCellIndexsForDateCellScheduleDayCodes(sundayIndex: DateCellIndex, dayCodes: DateCellScheduleDayCodesInput): DateCellIndex[] {
  return expandDateCellScheduleDayCodes(dayCodes).map((x) => sundayIndex + x - 1);
}
