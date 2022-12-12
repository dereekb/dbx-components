import { Minutes as UtilMinutes } from '@dereekb/util';
import { Expose, Type } from 'class-transformer';
import { IsNumber } from 'class-validator';
import { addMinutes } from 'date-fns';
import { DateRange, dateRangeState, DateRangeState } from './date.range';

export type Minutes = UtilMinutes; // TEMPORARY: weird issue with importing primative types with jest.

export interface DateDurationSpan {
  startsAt: Date;
  duration: Minutes;
}

export class DateDurationSpan {
  @Expose()
  @Type(() => Date)
  startsAt!: Date;

  @Expose()
  @IsNumber()
  duration!: Minutes;

  constructor(template?: DateDurationSpan) {
    if (template != null) {
      this.startsAt = template.startsAt;
      this.duration = template.duration;
    }
  }
}

/**
 * Returns the Date for the end time for the input DateDurationSpan.
 *
 * @param span
 * @returns
 */
export function dateDurationSpanEndDate(span: DateDurationSpan): Date {
  return addMinutes(span.startsAt, span.duration);
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
