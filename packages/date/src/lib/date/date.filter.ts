import { FilterFunction } from '@dereekb/util';
import { isAfter } from 'date-fns';
import { DateBlock, DateBlockDurationSpan } from './date.block';
import { dateDurationSpanEndDate } from './date.duration';

export type DateBlockDurationSpanFilterFunction<B extends DateBlock = DateBlock> = FilterFunction<DateBlockDurationSpan<B>>;

export function dateBlockDurationSpanHasNotStartedFilterFunction<B extends DateBlock = DateBlock>(now = new Date()): DateBlockDurationSpanFilterFunction<B> {
  return (x) => isAfter(x.startsAt, now);
}

export function dateBlockDurationSpanHasNotEndedFilterFunction<B extends DateBlock = DateBlock>(now = new Date()): DateBlockDurationSpanFilterFunction<B> {
  return (x) => {
    const endsAt = dateDurationSpanEndDate(x);
    return isAfter(endsAt, now);
  };
}
