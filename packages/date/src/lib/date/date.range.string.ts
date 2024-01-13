import { type ISO8601DayString, type DateOrDayString } from '@dereekb/util';
import { toISO8601DayString, toJsDayDate } from './date.format';
import { type DateRange } from './date.range';

// MARK: ISO8601DayStringRange
export interface ISO8601DayStringStart {
  start: ISO8601DayString;
}

export interface ISO8601DayStringRange extends ISO8601DayStringStart {
  end: ISO8601DayString;
}

// MARK: DateOrDayStringRange
export interface DateOrDayStringStart {
  start: DateOrDayString;
}

export interface DateOrDayStringRange extends DateOrDayStringStart {
  end: DateOrDayString;
}

export function dateOrDayStringRangeToDateRange(range: DateOrDayStringRange): DateRange {
  return {
    start: toJsDayDate(range.start),
    end: toJsDayDate(range.end)
  };
}

export function dateOrDayStringRangeToISO8601DayStringRange(range: DateOrDayStringRange): ISO8601DayStringRange {
  return {
    start: toISO8601DayString(range.start),
    end: toISO8601DayString(range.end)
  };
}
