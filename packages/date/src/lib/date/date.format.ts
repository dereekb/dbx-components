import { ISO8601DayString, MapFunction, Maybe } from '@dereekb/util';
import { differenceInMinutes, format, formatDistance, formatDistanceToNow, parse, startOfDay } from 'date-fns';
import { isDate, isSameDateDay } from './date';
import { dateOrDateRangeToDateRange, DateRange, dateRangeState, DateRangeState } from './date.range';

export type FormatDateFunction = MapFunction<Date, string>;
export type FormatDateRangeFunction = ((startOrDateRange: DateRange) => string) & ((startOrDateRange: Date, inputEnd?: Date) => string);

export interface FormatDateRangeFunctionConfig {
  /**
   * Formats function
   */
  format: FormatDateFunction;
  /**
   * Whether or not to modify the dates to be relative to UTC instead of the current.
   */
  normalizeToUTC?: boolean;
  /**
   * Custom separator
   */
  separator?: string;
  /**
   * Whether or not to allow only printing a single date if the date range is the same.
   *
   * False by default.
   */
  simplifySameDate?: boolean;
}

export type FormatDateRangeFunctionConfigInput = FormatDateFunction | FormatDateRangeFunctionConfig;

/**
 * Creates a FormatDateRangeFunction using the input config.
 *
 * @param inputConfig
 * @returns
 */
export function formatDateRangeFunction(inputConfig: FormatDateRangeFunctionConfigInput): FormatDateRangeFunction {
  const config = typeof inputConfig === 'function' ? { format: inputConfig } : inputConfig;
  const { format, separator = '-', simplifySameDate = false } = config;

  return (startOrDateRange: Date | DateRange, inputEnd?: Date) => {
    const { start, end } = isDate(startOrDateRange) ? { start: startOrDateRange, end: inputEnd as Date } : startOrDateRange;

    let string: string;

    if (simplifySameDate && isSameDateDay(start, end)) {
      string = format(start);
    } else {
      string = `${format(start)} ${separator} ${format(end)}`;
    }

    return string;
  };
}

/**
 * Formats the input date range using the start and end dates and a format function.
 */
export function formatDateRange(range: DateRange, inputConfig: FormatDateRangeFunctionConfigInput, separator?: string): string {
  const config = typeof inputConfig === 'function' ? { format: inputConfig, separator } : inputConfig;
  return formatDateRangeFunction(config)(range);
}

/**
 * Formats the input dates to be time start - end using formatToTimeString().
 *
 * I.E. 12:00AM - 4:00PM
 *
 * If the input dates are on different days, then the format will come from formatToDayTimeRangeString().
 *
 * I.E. 1/1/2001 12:00AM - 1/2/2001 4:00PM
 */
export function formatToTimeRangeString(startOrDateRange: DateRange): string;
export function formatToTimeRangeString(start: Date, end?: Maybe<Date>): string;
export function formatToTimeRangeString(startOrDateRange: DateRange | Date, end?: Maybe<Date>, onlyTimeRange?: boolean): string;
export function formatToTimeRangeString(startOrDateRange: DateRange | Date, end?: Maybe<Date>, onlyTimeRange = false): string {
  const dateRange = dateOrDateRangeToDateRange(startOrDateRange, end);
  const isSameDay = onlyTimeRange || isSameDateDay(dateRange.start, dateRange.end);

  let format: FormatDateFunction = isSameDay ? formatToTimeString : formatToShortDateAndTimeString;
  return formatDateRange(dateRange, { format, simplifySameDate: false });
}

/**
 * Formats the input dates to be date start - end using formatToShortDateAndTimeString().
 *
 * I.E. 1/1/2001 12:00AM - 1/2/2001 4:00PM
 */
export function formatToDayTimeRangeString(startOrDateRange: DateRange): string;
export function formatToDayTimeRangeString(start: Date, end?: Maybe<Date>): string;
export function formatToDayTimeRangeString(startOrDateRange: DateRange | Date, end?: Maybe<Date>): string {
  return formatDateRange(dateOrDateRangeToDateRange(startOrDateRange, end), { format: formatToShortDateAndTimeString, simplifySameDate: false });
}

/**
 * Formats the input dates to be date start - end using formatToShortDateString().
 *
 * I.E. 02/01/1992 - 03/01/1992
 */
export function formatToDayRangeString(startOrDateRange: DateRange): string;
export function formatToDayRangeString(start: Date, end?: Maybe<Date>): string;
export function formatToDayRangeString(startOrDateRange: DateRange | Date, end?: Maybe<Date>): string {
  return formatDateRange(dateOrDateRangeToDateRange(startOrDateRange, end), { format: formatToShortDateString, simplifySameDate: true });
}

export function formatToISO8601DateString(date: Date = new Date()): ISO8601DayString {
  return date.toISOString();
}

export function formatToISO8601DayString(date: Date = new Date()): ISO8601DayString {
  return format(date, 'yyyy-MM-dd');
}

export const dateShortDateStringFormat = 'MM/dd/yyyy';

export function formatToShortDateString(date: Date = new Date()): ISO8601DayString {
  return format(date, dateShortDateStringFormat);
}

export function formatToMonthDayString(date: Date = new Date()): ISO8601DayString {
  return format(date, 'MM/dd');
}

export function formatToDateString(date: Date): string {
  return format(date, 'EEE, MMM do');
}

export const dateTimeStringFormat = 'h:mm a';

export function formatToTimeString(date: Date): string {
  return format(date, dateTimeStringFormat);
}

export const dateShortDateAndTimeStringFormat = `${dateShortDateStringFormat} ${dateTimeStringFormat}`;

export function formatToShortDateAndTimeString(date: Date): string {
  return format(date, dateShortDateAndTimeStringFormat);
}

export function formatToTimeAndDurationString(start: Date, end: Date): string {
  const minutes = differenceInMinutes(end, start);
  let subtitle;

  if (minutes > 120) {
    subtitle = `(${formatDistance(end, start, { includeSeconds: false })})`;
  } else {
    subtitle = `${minutes ? `(${minutes} Minutes)` : ''}`;
  }

  return `${formatToTimeString(start)} ${subtitle}`;
}

export function formatStartedEndedDistanceString({ start, end }: DateRange): string {
  const state = dateRangeState({ start, end });
  let distanceText;

  switch (state) {
    case DateRangeState.PAST:
      distanceText = `ended ${formatDistanceToNow(end, {
        addSuffix: true
      })}`;
      break;
    case DateRangeState.PRESENT:
      distanceText = `started ${formatDistanceToNow(start, {
        addSuffix: true
      })}`;
      break;
    case DateRangeState.FUTURE:
      distanceText = `starting ${formatDistanceToNow(start, {
        addSuffix: true
      })}`;
      break;
  }

  return distanceText;
}

export function parseISO8601DayStringToDate(dateString: ISO8601DayString): Date {
  return startOfDay(parse(dateString, 'yyyy-MM-dd', new Date()));
}

export function parseISO8601DayStringToUTCDate(inputDateString: ISO8601DayString): Date {
  const [yearString, monthString, dateString] = inputDateString.split('-');
  return new Date(Date.UTC(Number(yearString), Number(monthString) - 1, Number(dateString)));
}

// MARK: Compat
/**
 * @Deprecated use parseISO8601DayStringToDate instead.
 */
export const dateStringToDate = parseISO8601DayStringToDate;

/**
 * @Deprecated use parseISO8601DayStringToUTCDate instead.
 */
export const dateStringToUTCDate = parseISO8601DayStringToUTCDate;
