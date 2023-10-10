import { FilterFunction, filterMaybeValues, Maybe } from '@dereekb/util';
import { isAfter, isBefore } from 'date-fns';
import { DateCell, DateCellDurationSpan } from './date.cell';
import { DateCellRange, UniqueDateCell, dateCellRangeWithRange, dateCellRangeOverlapsRangeFunction, isDateCellWithinDateCellRangeFunction } from './date.cell.index';
import { dateDurationSpanEndDate } from './date.duration';

export type DateCellDurationSpanFilterFunction<B extends DateCell = DateCell> = FilterFunction<DateCellDurationSpan<B>>;

export function dateCellDurationSpanHasStartedFilterFunction<B extends DateCell = DateCell>(now = new Date()): DateCellDurationSpanFilterFunction<B> {
  return (x) => !isAfter(x.startsAt, now); // startsAt <= now
}

export function dateCellDurationSpanHasNotStartedFilterFunction<B extends DateCell = DateCell>(now = new Date()): DateCellDurationSpanFilterFunction<B> {
  return (x) => isAfter(x.startsAt, now); // startsAt > now
}

export function dateCellDurationSpanHasEndedFilterFunction<B extends DateCell = DateCell>(now = new Date()): DateCellDurationSpanFilterFunction<B> {
  return (x) => {
    const endsAt = dateDurationSpanEndDate(x);
    return !isAfter(endsAt, now); // endsAt <= now
  };
}

export function dateCellDurationSpanHasNotEndedFilterFunction<B extends DateCell = DateCell>(now = new Date()): DateCellDurationSpanFilterFunction<B> {
  return (x) => {
    const endsAt = dateDurationSpanEndDate(x);
    return isAfter(endsAt, now); // endsAt > now
  };
}

/**
 * Modifies or filter out any blocks that are outside the range to fit within the configured range.
 */
export type ModifyDateCellsToFitRangeFunction = <B extends DateCell | DateCellRange | UniqueDateCell>(input: B[]) => B[];

/**
 * Creatse a ModifyDateCellsToFitRangeFunction
 */
export function modifyDateCellsToFitRangeFunction(range: DateCellRange): ModifyDateCellsToFitRangeFunction {
  const { i, to } = dateCellRangeWithRange(range);
  const dateCellIsWithinDateCellRange = isDateCellWithinDateCellRangeFunction(range);
  const overlapsRange = dateCellRangeOverlapsRangeFunction(range);

  return <B extends DateCell | DateCellRange | UniqueDateCell>(input: B[]) =>
    filterMaybeValues(
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

export function modifyDateCellsToFitRange<B extends DateCell | DateCellRange | UniqueDateCell>(range: DateCellRange, input: B[]): B[] {
  return modifyDateCellsToFitRangeFunction(range)(input);
}

export function modifyDateCellToFitRange<B extends DateCell | DateCellRange | UniqueDateCell>(range: DateCellRange, input: B): Maybe<B> {
  return modifyDateCellsToFitRange(range, [input])[0];
}
