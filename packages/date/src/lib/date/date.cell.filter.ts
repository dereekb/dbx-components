import { FilterFunction } from '@dereekb/util';
import { isAfter, isBefore } from 'date-fns';
import { DateCell, DateCellDurationSpan } from './date.cell';
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
