import { type FilterFunction, filterMaybeArrayValues, type Maybe } from '@dereekb/util';
import { isAfter } from 'date-fns';
import { type DateCell, type DateCellDurationSpan } from './date.cell';
import { type DateCellRange, type UniqueDateCell, dateCellRangeWithRange, dateCellRangeOverlapsRangeFunction, isDateCellWithinDateCellRangeFunction } from './date.cell.index';
import { dateDurationSpanEndDate } from './date.duration';

/**
 * A filter function that operates on {@link DateCellDurationSpan} values, typically used
 * to select date cells based on their temporal relationship to a reference point.
 */
export type DateCellDurationSpanFilterFunction<B extends DateCell = DateCell> = FilterFunction<DateCellDurationSpan<B>>;

/**
 * Creates a filter that passes date cell duration spans whose start time is at or before the given reference time.
 *
 * Useful for identifying events or blocks that have already begun relative to a point in time.
 *
 * @param now - Reference time to compare against. Defaults to the current time.
 *
 * @example
 * ```ts
 * const hasStarted = dateCellDurationSpanHasStartedFilterFunction(new Date());
 * const startedSpans = allSpans.filter(hasStarted);
 * ```
 */
export function dateCellDurationSpanHasStartedFilterFunction<B extends DateCell = DateCell>(now = new Date()): DateCellDurationSpanFilterFunction<B> {
  return (x) => !isAfter(x.startsAt, now); // startsAt <= now
}

/**
 * Creates a filter that passes date cell duration spans whose start time is strictly after the given reference time.
 *
 * The inverse of {@link dateCellDurationSpanHasStartedFilterFunction}. Useful for finding upcoming or future events.
 *
 * @param now - Reference time to compare against. Defaults to the current time.
 *
 * @example
 * ```ts
 * const hasNotStarted = dateCellDurationSpanHasNotStartedFilterFunction(new Date());
 * const futureSpans = allSpans.filter(hasNotStarted);
 * ```
 */
export function dateCellDurationSpanHasNotStartedFilterFunction<B extends DateCell = DateCell>(now = new Date()): DateCellDurationSpanFilterFunction<B> {
  return (x) => isAfter(x.startsAt, now); // startsAt > now
}

/**
 * Creates a filter that passes date cell duration spans whose computed end time is at or before the given reference time.
 *
 * The end time is derived from the span's start time and duration via {@link dateDurationSpanEndDate}.
 * Useful for identifying completed events.
 *
 * @param now - Reference time to compare against. Defaults to the current time.
 *
 * @example
 * ```ts
 * const hasEnded = dateCellDurationSpanHasEndedFilterFunction(new Date());
 * const completedSpans = allSpans.filter(hasEnded);
 * ```
 */
export function dateCellDurationSpanHasEndedFilterFunction<B extends DateCell = DateCell>(now = new Date()): DateCellDurationSpanFilterFunction<B> {
  return (x) => {
    const endsAt = dateDurationSpanEndDate(x);
    return !isAfter(endsAt, now); // endsAt <= now
  };
}

/**
 * Creates a filter that passes date cell duration spans whose computed end time is strictly after the given reference time.
 *
 * The inverse of {@link dateCellDurationSpanHasEndedFilterFunction}. Useful for finding events that are
 * still in progress or have not yet occurred.
 *
 * @param now - Reference time to compare against. Defaults to the current time.
 *
 * @example
 * ```ts
 * const hasNotEnded = dateCellDurationSpanHasNotEndedFilterFunction(new Date());
 * const activeOrFutureSpans = allSpans.filter(hasNotEnded);
 * ```
 */
export function dateCellDurationSpanHasNotEndedFilterFunction<B extends DateCell = DateCell>(now = new Date()): DateCellDurationSpanFilterFunction<B> {
  return (x) => {
    const endsAt = dateDurationSpanEndDate(x);
    return isAfter(endsAt, now); // endsAt > now
  };
}

/**
 * Adjusts or removes date cells so they fit within a configured {@link DateCellRange}.
 *
 * Cells fully within the range pass through unchanged. Cells that partially overlap are
 * clamped to the range boundaries. Cells entirely outside the range are removed.
 */
export type ModifyDateCellsToFitRangeFunction = <B extends DateCell | DateCellRange | UniqueDateCell>(input: B[]) => B[];

/**
 * Creates a reusable {@link ModifyDateCellsToFitRangeFunction} that clamps or filters date cells
 * to fit within the given range.
 *
 * Cells fully contained in the range are returned as-is. Overlapping cells have their `i` and `to`
 * indices clamped to the range boundaries. Non-overlapping cells are excluded entirely.
 *
 * @param range - The target range to fit cells into.
 *
 * @example
 * ```ts
 * const fitToRange = modifyDateCellsToFitRangeFunction({ i: 5, to: 15 });
 * const fitted = fitToRange(dateCells); // cells clamped to [5, 15]
 * ```
 */
export function modifyDateCellsToFitRangeFunction(range: DateCellRange): ModifyDateCellsToFitRangeFunction {
  const { i, to } = dateCellRangeWithRange(range);
  const dateCellIsWithinDateCellRange = isDateCellWithinDateCellRangeFunction(range);
  const overlapsRange = dateCellRangeOverlapsRangeFunction(range);

  return <B extends DateCell | DateCellRange | UniqueDateCell>(input: B[]) =>
    filterMaybeArrayValues(
      input.map((x) => {
        let result: Maybe<B>;

        const inRange = dateCellIsWithinDateCellRange(x);

        if (inRange) {
          // if contained within the range then return as-is
          result = x;
        } else {
          // fit to the range otherwise
          const asRange = dateCellRangeWithRange(x);
          const rangesOverlap = overlapsRange(asRange);

          if (rangesOverlap) {
            result = {
              ...x,
              i: Math.max(i, asRange.i), // should be no smaller than i
              to: Math.min(to, asRange.to) // should be no larger than to
            };
          }
        }

        return result;
      })
    );
}

/**
 * Convenience function that applies {@link modifyDateCellsToFitRangeFunction} directly to an array of date cells.
 *
 * Prefer {@link modifyDateCellsToFitRangeFunction} when processing multiple arrays against the same range
 * to avoid recomputing the range boundaries each time.
 *
 * @param range - The target range to fit cells into.
 * @param input - The date cells to clamp or filter.
 *
 * @example
 * ```ts
 * const fitted = modifyDateCellsToFitRange({ i: 0, to: 10 }, dateCells);
 * ```
 */
export function modifyDateCellsToFitRange<B extends DateCell | DateCellRange | UniqueDateCell>(range: DateCellRange, input: B[]): B[] {
  return modifyDateCellsToFitRangeFunction(range)(input);
}

/**
 * Convenience function that fits a single date cell to the given range, returning `undefined` if
 * the cell does not overlap the range at all.
 *
 * @param range - The target range to fit the cell into.
 * @param input - The single date cell to clamp or exclude.
 *
 * @example
 * ```ts
 * const fitted = modifyDateCellToFitRange({ i: 0, to: 10 }, dateCell);
 * if (fitted) {
 *   // cell overlaps the range
 * }
 * ```
 */
export function modifyDateCellToFitRange<B extends DateCell | DateCellRange | UniqueDateCell>(range: DateCellRange, input: B): Maybe<B> {
  return modifyDateCellsToFitRange(range, [input])[0];
}
