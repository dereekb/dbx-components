import { Minutes } from '@dereekb/util';
import { Expose, Type } from 'class-transformer';
import { addMinutes } from 'date-fns';
import { DateRange, dateRangeState, DateRangeState } from './date.range';

export interface DateDurationSpan {
  startsAt: Date;
  duration: Minutes;
}

export class DateDurationSpan {
  @Expose()
  @Type(() => Date)
  startsAt: Date;

  @Expose()
  duration: Minutes;

  constructor(template: DateDurationSpan) {
    this.startsAt = template.startsAt;
    this.duration = template.duration;
  }
}

export function durationSpanToDateRange(span: DateDurationSpan): DateRange {
  return {
    start: span.startsAt,
    end: addMinutes(span.startsAt, span.duration)
  };
}

export function durationSpanDateRangeState(span: DateDurationSpan): DateRangeState {
  return dateRangeState(durationSpanToDateRange(span));
}
