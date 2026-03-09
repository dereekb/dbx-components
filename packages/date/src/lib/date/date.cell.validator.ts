import { type } from 'arktype';
import { isValidDateCellTiming } from './date.cell';
import { isValidDateCellRange, isValidDateCellRangeSeries } from './date.cell.index';

/**
 * ArkType schema that validates a value is a valid {@link DateCellTiming}.
 */
export const validDateCellTimingType = type('unknown').narrow((val, ctx) => isValidDateCellTiming(val as any) || ctx.mustBe('a valid DateCellTiming'));

/**
 * ArkType schema that validates a value is a valid {@link DateCellRange} (non-negative indexes, `to >= i`).
 */
export const validDateCellRangeType = type('unknown').narrow((val, ctx) => isValidDateCellRange(val as any) || ctx.mustBe('a valid DateCellRange'));

/**
 * ArkType schema that validates a value is a sorted array of non-overlapping {@link DateCellRange} values.
 */
export const validDateCellRangeSeriesType = type('unknown').narrow((val, ctx) => isValidDateCellRangeSeries(val as any) || ctx.mustBe('a valid DateCellRange series with items sorted in ascending order and no repeat indexes'));
