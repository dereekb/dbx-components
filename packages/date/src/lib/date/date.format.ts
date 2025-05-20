import { type DateOrDateString, type DateOrDayString, type ISO8601DateString, type ISO8601DayString, type MapFunction, mapIdentityFunction, type Maybe, MonthDaySlashDate, repeatString, type UTCDateString } from '@dereekb/util';
import { differenceInMinutes, format, formatDistance, formatDistanceStrict, formatDistanceToNow, isSameDay, isValid, parse, startOfDay } from 'date-fns';
import { isDate, isSameDateDay, safeToJsDate } from './date';
import { dateOrDateRangeToDateRange, type DateRange, dateRangeRelativeState, fitUTCDateRangeToDayPeriod, transformDateRangeWithStartOfDay } from './date.range';
import { fitDateRangeToDayPeriodFunction } from './date.range.timezone';
import { type DateTimezoneUtcNormalFunctionInput } from './date.timezone';

export type FormatDateFunction = MapFunction<Date, string>;
export type FormatStrictDateRangeFunction = (startOrDateRange: DateRange) => string;
export type FormatDateRangeFunction = FormatStrictDateRangeFunction & ((startOrDateRange: Date, inputEnd?: Date) => string);

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
    const { start, end } = dateOrDateRangeToDateRange(startOrDateRange, inputEnd);
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
 * formatDateRangeDistanceFunction() configuration
 */
export type FormatDateRangeDistanceFunctionConfig = {
  /**
   * Transforms the input date range before computing the distance.
   */
  transform?: MapFunction<DateRange, DateRange>;
  /**
   * Whether or not to only consider the time distance between the two start times of the days.
   *
   * This is useful for cases where the comparison of the total time between the two elements is important, but not the days inbetween.
   */
  onlyTimeRange?: boolean;
  /**
   * (Optional) timezone to use when using onlyTimeRange. Defaults to UTC.
   */
  timeRangeTimezone?: DateTimezoneUtcNormalFunctionInput;
  /**
   * Optional function to format dates that fall on the same day.
   */
  formatSameDay?: FormatStrictDateRangeFunction;
} & (
  | (Parameters<typeof formatDistance>[2] & {
      strict?: false;
    })
  | (Parameters<typeof formatDistanceStrict>[2] & {
      strict: true;
    })
);

/**
 * Formats the input date range using the start and end dates and distance format function
 */
export function formatDateRangeDistanceFunction(inputConfig: FormatDateRangeDistanceFunctionConfig): FormatDateRangeFunction {
  const { transform: inputTransform, formatSameDay, onlyTimeRange, timeRangeTimezone, strict = false } = inputConfig;
  const transform: MapFunction<DateRange, DateRange> = inputTransform ?? (onlyTimeRange ? (timeRangeTimezone ? fitDateRangeToDayPeriodFunction(timeRangeTimezone) : fitUTCDateRangeToDayPeriod) : mapIdentityFunction());

  return (startOrDateRange: Date | DateRange, inputEnd?: Date) => {
    const dateRange = transform(dateOrDateRangeToDateRange(startOrDateRange, inputEnd));
    const { start, end } = dateRange;

    let string: string;

    if (formatSameDay != null && isSameDateDay(start, end)) {
      string = formatSameDay(dateRange);
    } else {
      if (strict) {
        string = formatDistanceStrict(end, start, inputConfig);
      } else {
        string = formatDistance(end, start, inputConfig);
      }
    }

    return string;
  };
}

/**
 * Legacy format date distance function that will format the input as start of day to end of day.
 */
export const formatDateDistance: FormatDateRangeFunction = formatDateRangeDistanceFunction({
  addSuffix: true,
  onlyTimeRange: false,
  transform: transformDateRangeWithStartOfDay,
  formatSameDay: (range: DateRange) => {
    let text: string;

    if (isSameDay(range.start, new Date())) {
      text = 'Today';
    } else {
      text = 'Same Day';
    }

    return text;
  }
});

/**
 * Formats the range between the two dates into a string.
 *
 * @param range
 * @param inputConfig
 * @returns
 */
export function formatDateRangeDistance(range: DateRange, inputConfig: FormatDateRangeDistanceFunctionConfig = {}): string {
  return formatDateRangeDistanceFunction(inputConfig)(range);
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

  const format: FormatDateFunction = isSameDay ? formatToTimeString : formatToShortDateAndTimeString;
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
 * Formats the input dates to be date start - end using formatToShortDateString(). Can alternatively specify a custom format function.
 *
 * I.E. 02/01/1992 - 03/01/1992
 */
export function formatToDayRangeString(startOrDateRange: DateRange, format?: FormatDateFunction): string;
export function formatToDayRangeString(start: Date, end?: Maybe<Date>, format?: FormatDateFunction): string;
export function formatToDayRangeString(startOrDateRange: DateRange | Date, endOrFormat?: Maybe<Date> | FormatDateFunction, inputFormat?: FormatDateFunction): string {
  let end: Maybe<Date>;

  if (endOrFormat != null) {
    if (typeof endOrFormat === 'function') {
      inputFormat = endOrFormat;
    } else {
      end = endOrFormat;
    }
  }

  const format: FormatDateFunction = inputFormat ?? formatToShortDateString;
  return formatDateRange(dateOrDateRangeToDateRange(startOrDateRange, end), { format, simplifySameDate: true });
}

/**
 * Safely formats the input to an ISO8601DateString if possible, otherwise returns undefined.
 *
 * @param input
 * @returns
 */
export function safeFormatToISO8601DateString(input: Maybe<DateOrDateString | UTCDateString>): ISO8601DateString | undefined {
  const date = safeToJsDate(input);
  return date != null && isValid(date) ? formatToISO8601DateString(date) : undefined;
}

export function formatToISO8601DateString(date: Date = new Date()): ISO8601DayString {
  return date.toISOString();
}

/**
 * Converts the input Date or ISO8601DayString to an ISO8601DayString using the system's date (not UTC date).
 *
 * Use formatToISO8601DayStringForUTC() for using the UTC date.
 *
 * @param dateOrString
 * @returns
 */
export function toISO8601DayStringForSystem(dateOrString: DateOrDayString): ISO8601DayString {
  return isDate(dateOrString) ? formatToISO8601DayStringForSystem(dateOrString) : dateOrString;
}

export function formatToISO8601DayStringForSystem(date: Date = new Date()): ISO8601DayString {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Converts the input Date or ISO8601DayString to an ISO8601DayString using the UTC date.
 *
 * @param dateOrString
 * @returns
 */
export function toISO8601DayStringForUTC(dateOrString: DateOrDayString): ISO8601DayString {
  return isDate(dateOrString) ? formatToISO8601DayStringForUTC(dateOrString) : dateOrString;
}

export function formatToISO8601DayStringForUTC(date: Date = new Date()): ISO8601DayString {
  return `${date.getUTCFullYear()}-${(date.getUTCMonth() + 1).toString().padStart(2, '0')}-${date.getUTCDate().toString().padStart(2, '0')}`;
}

export const monthDaySlashDateStringFormat = 'MM/dd/yyyy';

export function formatToMonthDaySlashDate(date: Date = new Date()): MonthDaySlashDate {
  return format(date, monthDaySlashDateStringFormat);
}

/**
 * @deprecated use formatToMonthDaySlashDate instead.
 */
export const formatToShortDateString = formatToMonthDaySlashDate;

export const dateMonthDayStringFormat = 'MM/dd';

export function formatToMonthDayString(date: Date = new Date()): ISO8601DayString {
  return format(date, dateMonthDayStringFormat);
}

export function formatToDateString(date: Date): string {
  return format(date, 'EEE, MMM do');
}

export const dateTimeStringFormat = 'h:mm a';

export function formatToTimeString(date: Date): string {
  return format(date, dateTimeStringFormat);
}

export const dateShortDateAndTimeStringFormat = `${monthDaySlashDateStringFormat} ${dateTimeStringFormat}`;

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
  const state = dateRangeRelativeState({ start, end });
  let distanceText;

  switch (state) {
    case 'past':
      distanceText = `ended ${formatDistanceToNow(end, {
        addSuffix: true
      })}`;
      break;
    case 'present':
      distanceText = `started ${formatDistanceToNow(start, {
        addSuffix: true
      })}`;
      break;
    case 'future':
      distanceText = `starting ${formatDistanceToNow(start, {
        addSuffix: true
      })}`;
      break;
  }

  return distanceText;
}

/**
 * Returns the input date as the start of the day in the system timezone, or parses the input ISO8601DayString to the start of the day in the system timezone.
 *
 * @param input
 * @returns
 */
export function toJsDayDate(input: DateOrDayString): Date {
  return isDate(input) ? startOfDay(input as Date) : parseISO8601DayStringToDate(input as string);
}

export function parseISO8601DayStringToDate(dayString: ISO8601DayString | ISO8601DateString): Date {
  // TODO: Does not support negative years.

  const inputSplit = dayString.split('-');
  const numberOfYs = inputSplit[0].length;

  const format = repeatString('y', numberOfYs) + '-MM-dd';
  dayString = dayString.slice(0, numberOfYs + 6); // remove everything past the days

  const result = parse(dayString, format, new Date());
  return startOfDay(result);
}

// MARK: Compat
/**
 * @deprecated use toISO8601DayStringForSystem instead for clarity. Will be removed in the future.
 */
export const toISO8601DayString = toISO8601DayStringForSystem;

/**
 * @deprecated use formatToISO8601DayStringForSystem instead for clarity. Will be removed in the future.
 */
export const formatToISO8601DayString = formatToISO8601DayStringForSystem;

/**
 * @deprecated use formatToMonthDaySlashDate instead for clarity. Will be removed in the future.
 */
export const dateShortDateStringFormat = monthDaySlashDateStringFormat;
