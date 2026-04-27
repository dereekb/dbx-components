import { type DateOrDateString, type DateOrDayString, type ISO8601DateString, type ISO8601DayString, type MapFunction, mapIdentityFunction, type Maybe, type MonthDaySlashDate, repeatString, type UTCDateString } from '@dereekb/util';
import { differenceInMinutes, format, formatDistance, formatDistanceStrict, formatDistanceToNow, isSameDay, isValid, parse, startOfDay } from 'date-fns';
import { isDate, isSameDateDay, safeToJsDate } from './date';
import { dateOrDateRangeToDateRange, type DateRange, dateRangeRelativeState, fitUTCDateRangeToDayPeriod, transformDateRangeWithStartOfDay } from './date.range';
import { fitDateRangeToDayPeriodFunction } from './date.range.timezone';
import { type DateTimezoneUtcNormalFunctionInput } from './date.timezone';

/**
 * Maps a Date to a formatted string representation.
 */
export type FormatDateFunction = MapFunction<Date, string>;

/**
 * Formats a DateRange into a human-readable string. Only accepts a DateRange input.
 */
export type FormatStrictDateRangeFunction = (startOrDateRange: DateRange) => string;

/**
 * Formats a date range into a human-readable string. Accepts either a DateRange object
 * or separate start/end Date arguments.
 */
export type FormatDateRangeFunction = FormatStrictDateRangeFunction & ((startOrDateRange: Date, inputEnd?: Date) => string);

/**
 * Configuration for creating a {@link FormatDateRangeFunction} via {@link formatDateRangeFunction}.
 */
export interface FormatDateRangeFunctionConfig {
  /**
   * Function used to format each individual date in the range.
   */
  readonly format: FormatDateFunction;
  /**
   * Whether to normalize dates to UTC before formatting.
   */
  readonly normalizeToUTC?: boolean;
  /**
   * Separator string placed between the formatted start and end dates. Defaults to `'-'`.
   */
  readonly separator?: string;
  /**
   * Whether to output a single formatted date when both dates fall on the same day.
   *
   * False by default.
   */
  readonly simplifySameDate?: boolean;
}

export type FormatDateRangeFunctionConfigInput = FormatDateFunction | FormatDateRangeFunctionConfig;

/**
 * Creates a reusable {@link FormatDateRangeFunction} from the given config or format function.
 *
 * Useful when the same range formatting logic needs to be applied repeatedly with consistent settings.
 *
 * @param inputConfig - format function or full configuration
 * @returns a reusable function that formats date ranges into strings
 *
 * @example
 * ```ts
 * import { formatDateRangeFunction, formatToTimeString } from '@dereekb/date';
 *
 * const formatRange = formatDateRangeFunction({
 *   format: formatToTimeString,
 *   separator: 'to',
 *   simplifySameDate: true
 * });
 *
 * const result = formatRange({ start: new Date('2024-01-15T09:00:00'), end: new Date('2024-01-15T17:00:00') });
 * // "9:00 AM to 5:00 PM"
 * ```
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
 * Convenience function that formats a date range in a single call without creating a reusable function.
 *
 * @param range - date range to format
 * @param inputConfig - format function or full configuration
 * @param separator - optional separator override when inputConfig is a function
 * @returns the formatted date range string
 *
 * @example
 * ```ts
 * import { formatDateRange, formatToTimeString } from '@dereekb/date';
 *
 * const result = formatDateRange(
 *   { start: new Date('2024-01-15T09:00:00'), end: new Date('2024-01-15T17:00:00') },
 *   formatToTimeString
 * );
 * // "9:00 AM - 5:00 PM"
 * ```
 */
export function formatDateRange(range: DateRange, inputConfig: FormatDateRangeFunctionConfigInput, separator?: string): string {
  const config = typeof inputConfig === 'function' ? { format: inputConfig, separator } : inputConfig;
  return formatDateRangeFunction(config)(range);
}

/**
 * Configuration for {@link formatDateRangeDistanceFunction}. Extends date-fns `formatDistance`/`formatDistanceStrict` options
 * to control how the human-readable distance string is produced.
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
 * Creates a reusable function that computes the human-readable distance between the start and end of a date range
 * (e.g., "3 hours", "about 2 days"). Delegates to date-fns `formatDistance` or `formatDistanceStrict`.
 *
 * @param inputConfig - controls distance formatting, optional transforms, and same-day handling
 * @returns a reusable function that computes and formats date range distances
 *
 * @example
 * ```ts
 * import { formatDateRangeDistanceFunction } from '@dereekb/date';
 *
 * const formatDist = formatDateRangeDistanceFunction({ strict: true, unit: 'hour' });
 * const result = formatDist({ start: new Date('2024-01-15T09:00:00'), end: new Date('2024-01-15T17:00:00') });
 * // "8 hours"
 * ```
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
 * Pre-configured {@link FormatDateRangeFunction} that computes the distance between the start-of-day
 * representations of two dates. Returns `'Today'` or `'Same Day'` when both dates fall on the same calendar day.
 *
 * Primarily retained for backward compatibility; prefer building a custom function via
 * {@link formatDateRangeDistanceFunction} for new use cases.
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
 * Convenience function that computes the human-readable distance for a date range in a single call.
 *
 * @param range - date range to compute distance for
 * @param inputConfig - optional distance formatting configuration
 * @returns the human-readable distance string
 *
 * @example
 * ```ts
 * import { formatDateRangeDistance } from '@dereekb/date';
 *
 * const result = formatDateRangeDistance(
 *   { start: new Date('2024-01-15T09:00:00'), end: new Date('2024-01-17T09:00:00') },
 *   { addSuffix: true }
 * );
 * // "in 2 days"
 * ```
 */
export function formatDateRangeDistance(range: DateRange, inputConfig: FormatDateRangeDistanceFunctionConfig = {}): string {
  return formatDateRangeDistanceFunction(inputConfig)(range);
}

/**
 * Formats a date range as a time-only range string when both dates are on the same day,
 * or falls back to a full date+time range when they span multiple days.
 *
 * Same day: `"12:00 AM - 4:00 PM"`
 * Different days: `"01/01/2001 12:00 AM - 01/02/2001 4:00 PM"`
 *
 * @example
 * ```ts
 * import { formatToTimeRangeString } from '@dereekb/date';
 *
 * // Same day - time only
 * formatToTimeRangeString({ start: new Date('2024-01-15T09:00:00'), end: new Date('2024-01-15T17:00:00') });
 * // "9:00 AM - 5:00 PM"
 *
 * // Different days - includes date
 * formatToTimeRangeString({ start: new Date('2024-01-15T09:00:00'), end: new Date('2024-01-16T17:00:00') });
 * // "01/15/2024 9:00 AM - 01/16/2024 5:00 PM"
 * ```
 *
 * @param startOrDateRange - date range object or start date
 * @param end - optional end date when a start date is provided
 * @param onlyTimeRange - whether to force time-only formatting regardless of date span
 * @returns the formatted time or date+time range string
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
 * Formats a date range as a full date+time range string, always including the date portion
 * regardless of whether both dates fall on the same day.
 *
 * Output: `"01/01/2001 12:00 AM - 01/02/2001 4:00 PM"`
 *
 * @example
 * ```ts
 * import { formatToDayTimeRangeString } from '@dereekb/date';
 *
 * formatToDayTimeRangeString({ start: new Date('2024-01-15T09:00:00'), end: new Date('2024-01-16T17:00:00') });
 * // "01/15/2024 9:00 AM - 01/16/2024 5:00 PM"
 * ```
 *
 * @param startOrDateRange - date range object or start date
 * @param end - optional end date when a start date is provided
 * @returns the formatted date+time range string
 */
export function formatToDayTimeRangeString(startOrDateRange: DateRange): string;
export function formatToDayTimeRangeString(start: Date, end?: Maybe<Date>): string;
export function formatToDayTimeRangeString(startOrDateRange: DateRange | Date, end?: Maybe<Date>): string {
  return formatDateRange(dateOrDateRangeToDateRange(startOrDateRange, end), { format: formatToShortDateAndTimeString, simplifySameDate: false });
}

/**
 * Formats a date range as a day-only range string using `MM/dd/yyyy` by default. When both dates
 * fall on the same day, only a single date is printed. Accepts an optional custom format function.
 *
 * Output: `"02/01/1992 - 03/01/1992"` or `"02/01/1992"` if same day
 *
 * @example
 * ```ts
 * import { formatToDayRangeString } from '@dereekb/date';
 *
 * formatToDayRangeString({ start: new Date('2024-01-15'), end: new Date('2024-01-20') });
 * // "01/15/2024 - 01/20/2024"
 *
 * formatToDayRangeString({ start: new Date('2024-01-15'), end: new Date('2024-01-15') });
 * // "01/15/2024"
 * ```
 *
 * @param startOrDateRange - date range object or start date
 * @param format - optional custom format function (when called with a DateRange)
 * @param endOrFormat - optional end date or custom format function
 * @param inputFormat - optional custom format function when end date is provided separately
 * @returns the formatted day range string
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

  const format: FormatDateFunction = inputFormat ?? formatToMonthDaySlashDate;
  return formatDateRange(dateOrDateRangeToDateRange(startOrDateRange, end), { format, simplifySameDate: true });
}

/**
 * Safely formats the input to an ISO 8601 date string, returning `undefined` for invalid or nullish inputs
 * instead of throwing.
 *
 * @param input - date, date string, or nullish value
 * @returns the ISO 8601 date string, or `undefined` if the input is invalid or nullish
 *
 * @example
 * ```ts
 * import { safeFormatToISO8601DateString } from '@dereekb/date';
 *
 * safeFormatToISO8601DateString(new Date('2024-01-15T12:00:00Z'));
 * // "2024-01-15T12:00:00.000Z"
 *
 * safeFormatToISO8601DateString(null);
 * // undefined
 *
 * safeFormatToISO8601DateString('invalid');
 * // undefined
 * ```
 */
export function safeFormatToISO8601DateString(input: Maybe<DateOrDateString | UTCDateString>): ISO8601DateString | undefined {
  const date = safeToJsDate(input);
  return date != null && isValid(date) ? formatToISO8601DateString(date) : undefined;
}

/**
 * Formats a Date to a full ISO 8601 date-time string via `Date.toISOString()`. Defaults to the current date/time.
 *
 * @param date - date to format; defaults to `new Date()`
 * @returns the full ISO 8601 date-time string
 *
 * @example
 * ```ts
 * import { formatToISO8601DateString } from '@dereekb/date';
 *
 * formatToISO8601DateString(new Date('2024-01-15T12:00:00Z'));
 * // "2024-01-15T12:00:00.000Z"
 * ```
 */
export function formatToISO8601DateString(date: Date = new Date()): ISO8601DayString {
  return date.toISOString();
}

/**
 * Converts a Date or day string to an ISO 8601 day string (`yyyy-MM-dd`) using the **system timezone**.
 * If the input is already a string, it is returned as-is.
 *
 * Use {@link toISO8601DayStringForUTC} when the UTC date is needed instead.
 *
 * @param dateOrString - date or existing day string
 * @returns the ISO 8601 day string in system timezone
 *
 * @example
 * ```ts
 * import { toISO8601DayStringForSystem } from '@dereekb/date';
 *
 * toISO8601DayStringForSystem(new Date('2024-01-15T20:00:00'));
 * // "2024-01-15" (in system timezone)
 *
 * toISO8601DayStringForSystem('2024-01-15');
 * // "2024-01-15" (pass-through)
 * ```
 */
export function toISO8601DayStringForSystem(dateOrString: DateOrDayString): ISO8601DayString {
  return isDate(dateOrString) ? formatToISO8601DayStringForSystem(dateOrString) : dateOrString;
}

/**
 * Formats a Date to an ISO 8601 day string (`yyyy-MM-dd`) using the **system timezone**.
 * Defaults to the current date.
 *
 * @param date - date to format; defaults to `new Date()`
 * @returns the ISO 8601 day string in system timezone
 *
 * @example
 * ```ts
 * import { formatToISO8601DayStringForSystem } from '@dereekb/date';
 *
 * formatToISO8601DayStringForSystem(new Date('2024-01-15T20:00:00'));
 * // "2024-01-15"
 * ```
 */
export function formatToISO8601DayStringForSystem(date: Date = new Date()): ISO8601DayString {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Converts a Date or day string to an ISO 8601 day string (`yyyy-MM-dd`) using the **UTC date**.
 * If the input is already a string, it is returned as-is.
 *
 * Use {@link toISO8601DayStringForSystem} when the system-local date is needed instead.
 *
 * @param dateOrString - date or existing day string
 * @returns the ISO 8601 day string in UTC
 *
 * @example
 * ```ts
 * import { toISO8601DayStringForUTC } from '@dereekb/date';
 *
 * // When system is UTC-5, this date is Jan 16 in UTC
 * toISO8601DayStringForUTC(new Date('2024-01-16T02:00:00Z'));
 * // "2024-01-16"
 *
 * toISO8601DayStringForUTC('2024-01-15');
 * // "2024-01-15" (pass-through)
 * ```
 */
export function toISO8601DayStringForUTC(dateOrString: DateOrDayString): ISO8601DayString {
  return isDate(dateOrString) ? formatToISO8601DayStringForUTC(dateOrString) : dateOrString;
}

/**
 * Formats a Date to an ISO 8601 day string (`yyyy-MM-dd`) using the **UTC date** components.
 * Defaults to the current date.
 *
 * @param date - date to format; defaults to `new Date()`
 * @returns the ISO 8601 day string using UTC date components
 *
 * @example
 * ```ts
 * import { formatToISO8601DayStringForUTC } from '@dereekb/date';
 *
 * formatToISO8601DayStringForUTC(new Date('2024-01-15T12:00:00Z'));
 * // "2024-01-15"
 * ```
 */
export function formatToISO8601DayStringForUTC(date: Date = new Date()): ISO8601DayString {
  return `${date.getUTCFullYear()}-${(date.getUTCMonth() + 1).toString().padStart(2, '0')}-${date.getUTCDate().toString().padStart(2, '0')}`;
}

/**
 * date-fns format string for `MM/dd/yyyy` (e.g., `"01/15/2024"`).
 */
export const MONTH_DAY_SLASH_DATE_STRING_FORMAT = 'MM/dd/yyyy';

/**
 * @deprecated Use MONTH_DAY_SLASH_DATE_STRING_FORMAT instead.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const monthDaySlashDateStringFormat = MONTH_DAY_SLASH_DATE_STRING_FORMAT;

/**
 * Formats a Date as a month/day/year slash-separated string (`MM/dd/yyyy`). Defaults to the current date.
 *
 * @param date - date to format; defaults to `new Date()`
 * @returns the formatted `MM/dd/yyyy` string
 *
 * @example
 * ```ts
 * import { formatToMonthDaySlashDate } from '@dereekb/date';
 *
 * formatToMonthDaySlashDate(new Date('2024-01-15'));
 * // "01/15/2024"
 * ```
 */
export function formatToMonthDaySlashDate(date: Date = new Date()): MonthDaySlashDate {
  return format(date, MONTH_DAY_SLASH_DATE_STRING_FORMAT);
}

/**
 * @deprecated use formatToMonthDaySlashDate instead.
 */
export const formatToShortDateString = formatToMonthDaySlashDate;

/**
 * date-fns format string for `MM/dd` (e.g., `"01/15"`).
 */
export const DATE_MONTH_DAY_STRING_FORMAT = 'MM/dd';

/**
 * @deprecated Use DATE_MONTH_DAY_STRING_FORMAT instead.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const dateMonthDayStringFormat = DATE_MONTH_DAY_STRING_FORMAT;

/**
 * Formats a Date as a month/day string (`MM/dd`) without the year. Defaults to the current date.
 *
 * @param date - date to format; defaults to `new Date()`
 * @returns the formatted `MM/dd` string
 *
 * @example
 * ```ts
 * import { formatToMonthDayString } from '@dereekb/date';
 *
 * formatToMonthDayString(new Date('2024-01-15'));
 * // "01/15"
 * ```
 */
export function formatToMonthDayString(date: Date = new Date()): ISO8601DayString {
  return format(date, DATE_MONTH_DAY_STRING_FORMAT);
}

/**
 * Formats a Date as a human-friendly weekday and month/day string (e.g., `"Mon, Jan 15th"`).
 *
 * @param date - date to format
 * @returns the formatted weekday and month/day string
 *
 * @example
 * ```ts
 * import { formatToDateString } from '@dereekb/date';
 *
 * formatToDateString(new Date('2024-01-15'));
 * // "Mon, Jan 15th"
 * ```
 */
export function formatToDateString(date: Date): string {
  return format(date, 'EEE, MMM do');
}

/**
 * date-fns format string for 12-hour time with AM/PM (e.g., `"9:00 AM"`).
 */
export const DATE_TIME_STRING_FORMAT = 'h:mm a';

/**
 * @deprecated Use DATE_TIME_STRING_FORMAT instead.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const dateTimeStringFormat = DATE_TIME_STRING_FORMAT;

/**
 * Formats a Date as a 12-hour time string with AM/PM (e.g., `"9:00 AM"`).
 *
 * @param date - date to format
 * @returns the formatted 12-hour time string with AM/PM
 *
 * @example
 * ```ts
 * import { formatToTimeString } from '@dereekb/date';
 *
 * formatToTimeString(new Date('2024-01-15T14:30:00'));
 * // "2:30 PM"
 * ```
 */
export function formatToTimeString(date: Date): string {
  return format(date, DATE_TIME_STRING_FORMAT);
}

/**
 * Combined date-fns format string for `MM/dd/yyyy h:mm a` (e.g., `"01/15/2024 9:00 AM"`).
 */
export const DATE_SHORT_DATE_AND_TIME_STRING_FORMAT = `${MONTH_DAY_SLASH_DATE_STRING_FORMAT} ${DATE_TIME_STRING_FORMAT}`;

/**
 * @deprecated Use DATE_SHORT_DATE_AND_TIME_STRING_FORMAT instead.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const dateShortDateAndTimeStringFormat = DATE_SHORT_DATE_AND_TIME_STRING_FORMAT;

/**
 * Formats a Date as a short date and time string (e.g., `"01/15/2024 9:00 AM"`).
 *
 * @param date - date to format
 * @returns the formatted short date and time string
 *
 * @example
 * ```ts
 * import { formatToShortDateAndTimeString } from '@dereekb/date';
 *
 * formatToShortDateAndTimeString(new Date('2024-01-15T14:30:00'));
 * // "01/15/2024 2:30 PM"
 * ```
 */
export function formatToShortDateAndTimeString(date: Date): string {
  return format(date, DATE_SHORT_DATE_AND_TIME_STRING_FORMAT);
}

/**
 * Formats a start time with an appended duration indicator. For durations over 2 hours, uses
 * a human-readable distance (e.g., `"about 3 hours"`); otherwise shows exact minutes.
 *
 * @param start - start date/time
 * @param end - end date/time
 * @returns the formatted time string with an appended duration indicator
 *
 * @example
 * ```ts
 * import { formatToTimeAndDurationString } from '@dereekb/date';
 *
 * // Short duration
 * formatToTimeAndDurationString(new Date('2024-01-15T09:00:00'), new Date('2024-01-15T10:30:00'));
 * // "9:00 AM (90 Minutes)"
 *
 * // Long duration
 * formatToTimeAndDurationString(new Date('2024-01-15T09:00:00'), new Date('2024-01-15T14:00:00'));
 * // "9:00 AM (about 5 hours)"
 * ```
 */
export function formatToTimeAndDurationString(start: Date, end: Date): string {
  const minutes = differenceInMinutes(end, start);
  let subtitle;

  if (minutes > 120) {
    subtitle = `(${formatDistance(end, start, { includeSeconds: false })})`;
  } else {
    const minutesLabel = minutes ? `(${minutes} Minutes)` : '';
    subtitle = minutesLabel;
  }

  return `${formatToTimeString(start)} ${subtitle}`;
}

/**
 * Produces a relative-time label describing a date range's state relative to now:
 * past (`"ended 2 hours ago"`), present (`"started 30 minutes ago"`), or future (`"starting in 3 days"`).
 *
 * @example
 * ```ts
 * import { formatStartedEndedDistanceString } from '@dereekb/date';
 *
 * // Range in the past
 * const pastRange = { start: new Date('2024-01-10'), end: new Date('2024-01-12') };
 * formatStartedEndedDistanceString(pastRange);
 * // "ended about 1 year ago"
 *
 * // Range currently active
 * const now = new Date();
 * const activeRange = { start: new Date(now.getTime() - 3600000), end: new Date(now.getTime() + 3600000) };
 * formatStartedEndedDistanceString(activeRange);
 * // "started about 1 hour ago"
 * ```
 *
 * @param dateRange - date range with start and end dates
 * @param dateRange.start - the start date of the range
 * @param dateRange.end - the end date of the range
 * @returns the relative-time label describing the date range state
 */
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
 * Normalizes a Date or ISO 8601 day string to the start of the day in the system timezone.
 * Useful for converting heterogeneous date inputs into a consistent midnight-aligned Date.
 *
 * @param input - date or day string to normalize
 * @returns a Date set to midnight of the corresponding day in the system timezone
 *
 * @example
 * ```ts
 * import { toJsDayDate } from '@dereekb/date';
 *
 * toJsDayDate(new Date('2024-01-15T14:30:00'));
 * // Date representing 2024-01-15T00:00:00 (system timezone)
 *
 * toJsDayDate('2024-01-15');
 * // Date representing 2024-01-15T00:00:00 (system timezone)
 * ```
 */
export function toJsDayDate(input: DateOrDayString): Date {
  return isDate(input) ? startOfDay(input) : parseISO8601DayStringToDate(input);
}

/**
 * Parses an ISO 8601 day string (e.g., `"2024-01-15"`) or full date string into a Date at the start of the day
 * in the system timezone. Supports year formats with more than 4 digits but does not support negative years.
 *
 * @param dayString - ISO 8601 day or date string to parse
 * @returns a Date at the start of the parsed day in the system timezone
 *
 * @example
 * ```ts
 * import { parseISO8601DayStringToDate } from '@dereekb/date';
 *
 * parseISO8601DayStringToDate('2024-01-15');
 * // Date representing 2024-01-15T00:00:00 (system timezone)
 *
 * parseISO8601DayStringToDate('2024-01-15T14:30:00Z');
 * // Date representing 2024-01-15T00:00:00 (system timezone, time portion stripped)
 * ```
 */
export function parseISO8601DayStringToDate(dayString: ISO8601DayString | ISO8601DateString): Date {
  // TODO: Does not support negative years.

  const inputSplit = dayString.split('-');
  const numberOfYs = inputSplit[0].length;

  const format = repeatString('y', numberOfYs) + '-MM-dd';
  dayString = dayString.slice(0, numberOfYs + 6); // remove everything past the days

  const result = parse(dayString, format, new Date());
  return startOfDay(result);
}
