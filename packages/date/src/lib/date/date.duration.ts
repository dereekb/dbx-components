import { type DateRelativeState, type FractionalHour, type Minutes as UtilMinutes, minutesToFractionalHours, type Maybe, safeCompareEquality } from '@dereekb/util';
import { Expose, Type } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';
import { addMinutes } from 'date-fns';
import { type DateRange, dateRangeRelativeState } from './date.range';
import { isSameDate } from './date';

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
  @Min(0) // minimum duration of 0
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

export function durationSpanDateRelativeState(span: DateDurationSpan, now?: Date): DateRelativeState {
  return dateRangeRelativeState(durationSpanToDateRange(span), now);
}

export function fractionalHoursInDurationSpan(span: DateDurationSpan): FractionalHour {
  return minutesToFractionalHours(span.duration);
}

/**
 * EqualityComparatorFunction for two input DateDurationSpan values.
 *
 * @param a
 * @param b
 * @returns
 */
export function isSameDurationSpan(a: DateDurationSpan, b: DateDurationSpan): boolean;
export function isSameDurationSpan(a: Maybe<DateDurationSpan>, b: Maybe<DateDurationSpan>): boolean;
export function isSameDurationSpan(a: Maybe<DateDurationSpan>, b: Maybe<DateDurationSpan>): boolean {
  return safeCompareEquality(a, b, (a, b) => a.duration === b.duration && isSameDate(a.startsAt, b.startsAt));
}
