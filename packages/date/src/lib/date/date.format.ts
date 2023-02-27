import { ISO8601DayString, MapFunction } from '@dereekb/util';
import { differenceInMinutes, format, formatDistance, formatDistanceToNow, parse, startOfDay } from 'date-fns';
import { isDate } from './date';
import { DateRange, dateRangeState, DateRangeState } from './date.range';

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
  const { format, separator = '-' } = config;

  return (startOrDateRange: Date | DateRange, inputEnd?: Date) => {
    const { start, end } = isDate(startOrDateRange) ? { start: startOrDateRange, end: inputEnd as Date } : startOrDateRange;

    const string = `${format(start)} ${separator} ${format(end)}`;
    return string;
  };
}

/**
 * Formats the input date range using the start and end dates and a format function.
 */
export function formatDateRange(range: DateRange, format: (date: Date) => string, separator?: string): string {
  return formatDateRangeFunction({ format, separator })(range);
}

/**
 * Formats the input dates to be time start - end using formatToTimeString().
 *
 * I.E. 12:00AM - 4:00PM
 */
export function formatToTimeRangeString(start: Date, end: Date): string {
  return formatDateRange({ start, end }, formatToTimeString);
}

/**
 * Formats the input dates to be date start - end using formatToShortDateString().
 *
 * I.E. 02/01/1992 - 03/01/1992
 */
export function formatToDayRangeString(start: Date, end: Date): string {
  return formatDateRange({ start, end }, formatToShortDateString);
}

export function formatToISO8601DateString(date: Date = new Date()): ISO8601DayString {
  return date.toISOString();
}

export function formatToISO8601DayString(date: Date = new Date()): ISO8601DayString {
  return format(date, 'yyyy-MM-dd');
}

export function formatToShortDateString(date: Date = new Date()): ISO8601DayString {
  return format(date, 'MM/dd/yyyy');
}

export function formatToMonthDayString(date: Date = new Date()): ISO8601DayString {
  return format(date, 'MM/dd');
}

export function formatToDateString(date: Date): string {
  return format(date, 'EEE, MMM do');
}

export function formatToTimeString(date: Date): string {
  return format(date, 'h:mm a');
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
