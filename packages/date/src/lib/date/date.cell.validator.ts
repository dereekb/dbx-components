import { type } from 'arktype';
import { dateCellTimingType, isValidDateCellTiming } from './date.cell';
import { dateCellRangeType, isValidDateCellRange, isValidDateCellRangeSeries } from './date.cell.index';

/**
 * ArkType schema that validates a value is a valid {@link DateCellTiming}.
 */
export const validDateCellTimingType = dateCellTimingType.narrow((val, ctx) => (val != null && isValidDateCellTiming(val)) || ctx.mustBe('a valid DateCellTiming'));

/**
 * ArkType schema that validates a value is a valid {@link DateCellRange} (non-negative indexes, `to >= i`).
 */
export const validDateCellRangeType = dateCellRangeType.narrow((val, ctx) => (val != null && isValidDateCellRange(val)) || ctx.mustBe('a valid DateCellRange'));

/**
 * ArkType schema that validates a value is a sorted array of non-overlapping {@link DateCellRange} values.
 */
export const validDateCellRangeSeriesType = type(dateCellRangeType.array()).narrow((val, ctx) => (val != null && isValidDateCellRangeSeries(val)) || ctx.mustBe('a valid DateCellRange series with items sorted in ascending order and no repeat indexes'));
