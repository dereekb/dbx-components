import { type DateRelativeState, type FractionalHour, type Minutes, minutesToFractionalHours, type Maybe, safeCompareEquality } from '@dereekb/util';
import { addMinutes, differenceInMinutes } from 'date-fns';
import { type DateRange, dateRangeRelativeState } from './date.range';
import { isSameDate } from './date';

/**
 * Represents a time span with a start date and a duration in minutes.
 *
 * Used throughout the date cell system to define when events begin and how long they last.
 */
export interface DateDurationSpan {
  startsAt: Date;
  duration: Minutes;
}

/**
 * Computes the end date for a duration span by adding the duration to the start time.
 *
 * @param span - Span whose end date should be computed.
 * @returns Moment when the span ends.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilTags date, duration, span, end, compute, time
 * @dbxUtilRelated duration-span-to-date-range, duration-span-from-date-range
 *
 * @example
 * ```ts
 * const span = { startsAt: new Date('2024-01-01T10:00:00Z'), duration: 60 };
 * dateDurationSpanEndDate(span); // 2024-01-01T11:00:00Z
 * ```
 */
export function dateDurationSpanEndDate(span: DateDurationSpan): Date {
  return addMinutes(span.startsAt, span.duration);
}

/**
 * Converts a {@link DateDurationSpan} to a {@link DateRange} with start and end dates.
 *
 * @param span - Span to project onto a start/end date range.
 * @returns Range from startsAt to startsAt + duration.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilTags date, duration, span, range, convert
 * @dbxUtilRelated date-duration-span-end-date, duration-span-from-date-range
 */
export function durationSpanToDateRange(span: DateDurationSpan): DateRange {
  return {
    start: span.startsAt,
    end: addMinutes(span.startsAt, span.duration)
  };
}

/**
 * Creates a {@link DateDurationSpan} from a {@link DateRange} by computing the duration in minutes between start and end.
 *
 * @param dateRange - Range to project onto a duration span.
 * @returns Span anchored at the range's start with duration measured to its end.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilTags date, duration, span, range, convert, minutes
 * @dbxUtilRelated duration-span-to-date-range, date-duration-span-end-date
 */
export function durationSpanFromDateRange(dateRange: DateRange): DateDurationSpan {
  return {
    startsAt: dateRange.start,
    duration: differenceInMinutes(dateRange.end, dateRange.start)
  };
}

/**
 * Determines whether a duration span is in the past, present, or future relative to the given time.
 *
 * @param span - The duration span to check.
 * @param now - Reference time (defaults to current time)
 * @returns 'past', 'present', or 'future'.
 */
export function durationSpanDateRelativeState(span: DateDurationSpan, now?: Date): DateRelativeState {
  return dateRangeRelativeState(durationSpanToDateRange(span), now);
}

/**
 * Converts a duration span's duration from minutes to fractional hours.
 *
 * @param span - The duration span to measure.
 * @returns The duration expressed as fractional hours (e.g. 90 minutes = 1.5)
 */
export function fractionalHoursInDurationSpan(span: DateDurationSpan): FractionalHour {
  return minutesToFractionalHours(span.duration);
}

/**
 * Null-safe equality check for two {@link DateDurationSpan} values, comparing both startsAt and duration.
 *
 * @param a - first span
 * @param b - second span
 * @returns whether the spans are equal (or both nullish)
 */
export function isSameDurationSpan(a: DateDurationSpan, b: DateDurationSpan): boolean;
export function isSameDurationSpan(a: Maybe<DateDurationSpan>, b: Maybe<DateDurationSpan>): boolean;
export function isSameDurationSpan(a: Maybe<DateDurationSpan>, b: Maybe<DateDurationSpan>): boolean {
  return safeCompareEquality(a, b, (a, b) => a.duration === b.duration && isSameDate(a.startsAt, b.startsAt));
}
