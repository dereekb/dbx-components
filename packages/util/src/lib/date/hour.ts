import { cutValueToPrecisionFunction } from '../number/round';
import { type Maybe } from '../value/maybe.type';
import { type Hours, type Minutes, MINUTES_IN_HOUR, MINUTES_IN_DAY, HOURS_IN_DAY } from './date';
import { type MinutesIncrement, type MinutesIncrementConverter, type MinutesIncrementConverterConfig, minutesIncrementConverter } from './minute';

/**
 * A number that represents hours and rounded to the nearest minute.
 *
 * It has only three decimal places max.
 *
 * Fractional hours are safe to add together.
 *
 * For example:
 *
 * - 10 minutes: 0.16
 * - 15 minutes : 0.25
 *
 * @semanticType
 * @semanticTopic date
 * @semanticTopic numeric
 */
export type FractionalHour = number;

/**
 * Precision function that rounds fractional hour values to 3 decimal places.
 */
export const FRACTIONAL_HOURS_PRECISION_FUNCTION = cutValueToPrecisionFunction(3);

/**
 * Converts the number of minutes to a fractional hour.
 *
 * Minutes are rounded down before conversion.
 *
 * @param minutes - Number of minutes to convert.
 * @returns The equivalent fractional hour value.
 */
export function minutesToFractionalHours(minutes: Minutes): FractionalHour {
  return FRACTIONAL_HOURS_PRECISION_FUNCTION(Math.floor(minutes) / MINUTES_IN_HOUR);
}

/**
 * Converts a fractional hour value to the equivalent number of minutes.
 *
 * @param hours - Fractional hour value to convert.
 * @returns The equivalent number of minutes (rounded)
 */
export function fractionalHoursToMinutes(hours: FractionalHour): Minutes {
  return Math.round(hours * MINUTES_IN_HOUR);
}

/**
 * Rounds the input hour to the nearest FractionalHour precision (3 decimal places).
 *
 * @param hour - The hour value to round.
 * @returns The rounded fractional hour.
 */
export function hourToFractionalHour(hour: Hours): FractionalHour {
  return minutesToFractionalHours(fractionalHoursToMinutes(hour));
}

/**
 * Input for computing the next fractional hour by adding minutes and/or hours.
 */
export interface ComputeFractionalHour {
  readonly minutes?: Maybe<Minutes>;
  readonly hours?: Maybe<Hours>;
}

/**
 * Computes the next fractional hour by adding the specified hours and minutes to the input value.
 *
 * @param input - The starting fractional hour value.
 * @param change - The hours and/or minutes to add.
 * @returns The resulting fractional hour.
 */
export function computeNextFractionalHour(input: FractionalHour, change: ComputeFractionalHour): FractionalHour {
  let result = input;

  if (change.minutes) {
    result += minutesToFractionalHours(change.minutes);
  }

  if (change.hours) {
    result += hourToFractionalHour(change.hours);
  }

  return result;
}

/**
 * The hour of the day.
 *
 * Number from 0-23.
 *
 * @semanticType
 * @semanticTopic date
 * @semanticTopic numeric
 */
export type HourOfDay = number;

export const HOUR_OF_DAY_MINIUMUM = 0;
export const HOUR_OF_DAY_MAXMIMUM = HOURS_IN_DAY - 1;

/**
 * Returns true if the input value is a valid HourOfDay (0-23).
 *
 * @param input - Candidate value to validate against the HourOfDay range.
 * @returns True when the value falls within 0-23.
 */
export function isHourOfDay(input: number): input is HourOfDay {
  return input >= HOUR_OF_DAY_MINIUMUM && input <= HOUR_OF_DAY_MAXMIMUM;
}

/**
 * The minute of the day.
 *
 * Number from 0-1439.
 *
 * @semanticType
 * @semanticTopic date
 * @semanticTopic numeric
 */
export type MinuteOfDay = number;

/**
 * A MinuteOfDay expressed as a MinutesIncrement, which is the index of the increment of the day that contains it.
 *
 * For example, with a 15 minute increment: 0 (00:00) is 0, 15 (00:15) is 1, 60 (01:00) is 4, and 1425 (23:45) is 95.
 *
 * Is always an integer.
 *
 * Optional generic typing exists for communicating the increment size in minutes.
 *
 * Use minuteOfDayIncrementConverter() to convert between MinuteOfDay and MinuteOfDayIncrement values.
 *
 * @semanticType
 * @semanticTopic date
 * @semanticTopic numeric
 */
export type MinuteOfDayIncrement<T extends Minutes = Minutes> = MinutesIncrement<T>;

/**
 * A MinuteOfDayIncrement for a 15 minute increment, where each value is a quarter hour of the day.
 *
 * Number from 0-95.
 *
 * @semanticType
 * @semanticTopic date
 * @semanticTopic numeric
 */
export type MinuteOfDayFifteenMinuteIncrement = MinuteOfDayIncrement<15>;

export const MINUTE_OF_DAY_MINIUMUM = 0;
export const MINUTE_OF_DAY_MAXMIMUM = MINUTES_IN_DAY - 1;

/**
 * Returns true if the input value is a valid MinuteOfDay (0-1439).
 *
 * @param input - Candidate value to validate against the MinuteOfDay range.
 * @returns True when the value falls within 0-1439.
 */
export function isMinuteOfDay(input: number): input is MinuteOfDay {
  return input >= MINUTE_OF_DAY_MINIUMUM && input <= MINUTE_OF_DAY_MAXMIMUM;
}

/**
 * A pair of hours and minutes.
 */
export interface HoursAndMinutes {
  readonly hour: Hours;
  readonly minute: Minutes;
}

/**
 * Converts the input number of minutes to the equivalent in hours and minutes.
 *
 * @param inputMinutes - Total minutes to break down.
 * @returns Split hour-and-minute pair representing the same duration.
 */
export function minutesToHoursAndMinutes(inputMinutes: Minutes): HoursAndMinutes {
  const hour = Math.floor(inputMinutes / 60);
  const minute = inputMinutes % 60;

  return {
    hour,
    minute
  };
}

/**
 * Reads the hour and minutes of the Date in the local timezone.
 *
 * @param date - Reference instant whose local clock time should be split.
 * @returns Local-time hour-and-minute pair for `date`.
 */
export function dateToHoursAndMinutes(date: Date): HoursAndMinutes {
  const hour = date.getHours();
  const minute = date.getMinutes();
  return {
    hour,
    minute
  };
}

/**
 * Converts the input hours and minutes to a MinuteOfDay.
 *
 * @param hour - The hour component (0-23)
 * @param minute - The minute component (0-59)
 * @returns The corresponding MinuteOfDay value.
 */
export function toMinuteOfDay(hour: Hours, minute: Minutes): MinuteOfDay {
  return asMinuteOfDay(hour * 60 + minute);
}

/**
 * Creates a new date with the time set to the given minute of the day.
 *
 * @param minuteOfDay - The minute of the day (0-1439)
 * @param day - Optional base date to use (defaults to the current date)
 * @returns Instant at the requested minute-of-day on the supplied calendar day.
 */
export function dateFromMinuteOfDay(minuteOfDay: Minutes | MinuteOfDay, day?: Date) {
  const date = day ?? new Date();
  const { hour, minute } = minutesToHoursAndMinutes(asMinuteOfDay(minuteOfDay));
  date.setHours(hour, minute, 0, 0);
  return date;
}

/**
 * Converts a Date to a MinuteOfDay based on the local timezone.
 *
 * @param date - Reference instant whose local clock should be folded into the day.
 * @returns Minute-of-day for `date` in the system timezone.
 */
export function dateToMinuteOfDay(date: Date): MinuteOfDay {
  const { hour, minute } = dateToHoursAndMinutes(date);
  return toMinuteOfDay(hour, minute);
}

/**
 * Converts the input minutes to a valid MinuteOfDay by wrapping around the day boundary.
 *
 * @param minutes - The minutes value to convert.
 * @returns A MinuteOfDay value (0-1439)
 */
export function asMinuteOfDay(minutes: Minutes): MinuteOfDay {
  return Math.max(0, minutes % MINUTES_IN_DAY);
}

/**
 * minuteOfDayIncrementConverter() configuration.
 *
 * Fractional increments are not allowed, since a MinuteOfDay is always an integer.
 */
export type MinuteOfDayIncrementConverterConfig<T extends Minutes = Minutes> = Omit<MinutesIncrementConverterConfig<T>, 'allowFractionalIncrement'>;

export type MinuteOfDayIncrementConverterInput<T extends Minutes = Minutes> = MinuteOfDayIncrementConverterConfig<T> | T;

/**
 * Converts between MinuteOfDay and MinuteOfDayIncrement values for a specific increment size.
 *
 * All conversions wrap around the day boundary, so a value that rounds up past the last increment of the day becomes 0 (midnight).
 */
export interface MinuteOfDayIncrementConverter<T extends Minutes = Minutes> extends MinutesIncrementConverter<T> {
  /**
   * Number of increments in a day. For example, 96 for a 15 minute increment.
   */
  readonly incrementsInDay: number;
  /**
   * Reduces the MinuteOfDay to a MinuteOfDayIncrement using the configured rounding.
   */
  readonly reduce: (minuteOfDay: MinuteOfDay) => MinuteOfDayIncrement<T>;
  /**
   * Expands the MinuteOfDayIncrement to the MinuteOfDay at the start of that increment.
   */
  readonly expand: (increment: MinuteOfDayIncrement<T>) => MinuteOfDay;
  /**
   * Rounds the MinuteOfDay to the start of an increment using the configured rounding. Equivalent to expand(reduce(minuteOfDay)).
   */
  readonly round: (minuteOfDay: MinuteOfDay) => MinuteOfDay;
}

/**
 * Creates a MinuteOfDayIncrementConverter that reduces MinuteOfDay values to MinuteOfDayIncrement values, expands them back, and rounds MinuteOfDay values to the start of an increment.
 *
 * Accepts either an increment size (uses 'floor' rounding) or a full config with the increment and rounding type.
 *
 * @param input - Increment size in minutes, or full configuration.
 * @returns Converter that reduces, expands, and rounds MinuteOfDay values by the increment.
 * @throws {Error} If the increment is not a positive integer.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilKind factory
 * @dbxUtilTags date, minute, minute-of-day, increment, round, convert, factory
 * @dbxUtilRelated minutes-increment-converter, number-factor-converter
 *
 * @example
 * ```ts
 * const converter = minuteOfDayIncrementConverter(15);
 * converter.reduce(68); // 4 (01:08 is within the 01:00 increment)
 * converter.expand(4); // 60
 * converter.round(68); // 60
 *
 * const ceilConverter = minuteOfDayIncrementConverter({ increment: 15, round: 'ceil' });
 * ceilConverter.round(68); // 75
 * ceilConverter.round(1439); // 0 (wraps to midnight)
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function minuteOfDayIncrementConverter<T extends Minutes = Minutes>(input: MinuteOfDayIncrementConverterInput<T>): MinuteOfDayIncrementConverter<T> {
  const minutesConverter = minutesIncrementConverter<T>(typeof input === 'number' ? input : { ...input, allowFractionalIncrement: false });
  const { increment } = minutesConverter;
  const incrementsInDay = Math.ceil(MINUTES_IN_DAY / increment);
  const wrapIncrement = (x: MinuteOfDayIncrement<T>) => Math.max(0, x % incrementsInDay);

  const reduce = (minuteOfDay: MinuteOfDay) => wrapIncrement(minutesConverter.reduce(asMinuteOfDay(minuteOfDay)));
  const expand = (x: MinuteOfDayIncrement<T>) => minutesConverter.expand(wrapIncrement(x));

  return {
    increment,
    incrementsInDay,
    reduce,
    expand,
    round: (minuteOfDay: MinuteOfDay) => expand(reduce(minuteOfDay))
  };
}

/**
 * Returns a human-readable string that represents the input hours and minutes.
 *
 * Examples:
 * - {} -> ''
 * - { hour: 1, minute: 30 } -> "1 hours and 30 minutes"
 * - { hour: 1 } -> "1 hours"
 * - { minute: 30 } -> "30 minutes"
 *
 * @param input - The hours and minutes to format.
 * @returns A human-readable string representation.
 */
export function hoursAndMinutesToString(input: HoursAndMinutes): string {
  const { hour, minute } = input;
  let result = '';

  if (hour && minute) {
    result = `${hour} hours and ${minute} minutes`;
  } else if (hour) {
    result = `${hour} hours`;
  } else if (minute) {
    result = `${minute} minutes`;
  }

  return result;
}
