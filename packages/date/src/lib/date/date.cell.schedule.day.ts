import { type DateCellIndex } from './date.cell';
import { type DateCellScheduleDayCodesInput, expandDateCellScheduleDayCodes } from './date.cell.schedule';

/**
 * Converts schedule day codes into absolute {@link DateCellIndex} values relative to a known Sunday index.
 *
 * Each day code is expanded to its corresponding day(s) of the week, then offset from the Sunday reference index.
 *
 * @param sundayIndex - the DateCellIndex for the Sunday of the target week
 * @param dayCodes - day codes to convert (e.g. WEEKDAY, individual days)
 * @returns array of DateCellIndex values for the matching days
 *
 * @example
 * ```ts
 * // If index 0 is Sunday, get indexes for weekdays (Mon-Fri)
 * dateCellIndexsForDateCellScheduleDayCodes(0, [DateCellScheduleDayCode.WEEKDAY]);
 * // [1, 2, 3, 4, 5]
 * ```
 */
export function dateCellIndexsForDateCellScheduleDayCodes(sundayIndex: DateCellIndex, dayCodes: DateCellScheduleDayCodesInput): DateCellIndex[] {
  return expandDateCellScheduleDayCodes(dayCodes).map((x) => sundayIndex + x - 1);
}
