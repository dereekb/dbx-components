import { FilterFunction } from '@dereekb/util';
import { isAfter, isBefore } from 'date-fns';
import { DateBlock, DateBlockDurationSpan } from './date.block';
import { dateDurationSpanEndDate } from './date.duration';

export type DateBlockDurationSpanFilterFunction<B extends DateBlock = DateBlock> = FilterFunction<DateBlockDurationSpan<B>>;

export function dateBlockDurationSpanHasStartedFilterFunction<B extends DateBlock = DateBlock>(now = new Date()): DateBlockDurationSpanFilterFunction<B> {
  return (x) => !isAfter(x.startsAt, now); // startsAt <= now
}

export function dateBlockDurationSpanHasNotStartedFilterFunction<B extends DateBlock = DateBlock>(now = new Date()): DateBlockDurationSpanFilterFunction<B> {
  return (x) => isAfter(x.startsAt, now); // startsAt > now
}

export function dateBlockDurationSpanHasEndedFilterFunction<B extends DateBlock = DateBlock>(now = new Date()): DateBlockDurationSpanFilterFunction<B> {
  return (x) => {
    const endsAt = dateDurationSpanEndDate(x);
    return !isAfter(endsAt, now); // endsAt <= now
  };
}

export function dateBlockDurationSpanHasNotEndedFilterFunction<B extends DateBlock = DateBlock>(now = new Date()): DateBlockDurationSpanFilterFunction<B> {
  return (x) => {
    const endsAt = dateDurationSpanEndDate(x);
    return isAfter(endsAt, now); // endsAt > now
  };
}
