import { cutValueToPrecisionFunction } from '../number/round';
import { type Maybe } from '../value/maybe.type';
import { type Hours, type Minutes, MINUTES_IN_HOUR, MINUTES_IN_DAY } from './date';

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
 * @param minutes - Number of minutes to convert
 * @returns The equivalent fractional hour value
 */
export function minutesToFractionalHours(minutes: Minutes): FractionalHour {
  return FRACTIONAL_HOURS_PRECISION_FUNCTION(Math.floor(minutes) / MINUTES_IN_HOUR);
}

/**
 * Converts a fractional hour value to the equivalent number of minutes.
 *
 * @param hours - Fractional hour value to convert
 * @returns The equivalent number of minutes (rounded)
 */
export function fractionalHoursToMinutes(hours: FractionalHour): Minutes {
  return Math.round(hours * MINUTES_IN_HOUR);
}

/**
 * Rounds the input hour to the nearest FractionalHour precision (3 decimal places).
 *
 * @param hour - The hour value to round
 * @returns The rounded fractional hour
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
 * @param input - The starting fractional hour value
 * @param change - The hours and/or minutes to add
 * @returns The resulting fractional hour
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
 * The minute of the day.
 *
 * Number from 0-1439.
 */
export type MinuteOfDay = number;

export const MINUTE_OF_DAY_MINIUMUM = 0;
export const MINUTE_OF_DAY_MAXMIMUM = MINUTES_IN_DAY - 1;

/**
 * Returns true if the input value is a valid MinuteOfDay (0-1439).
 *
 * @param input - The number to validate
 * @returns True if the input is within the valid MinuteOfDay range
 */
export function isMinuteOfDay(input: number): input is MinuteOfDay {
  return input >= MINUTE_OF_DAY_MINIUMUM && input <= MINUTE_OF_DAY_MAXMIMUM;
}

/**
 * A pair of hours and minutes.
 */
export interface HoursAndMinutes {
  readonly hour: number;
  readonly minute: number;
}

/**
 * Converts the input number of minutes to the equivalent in hours and minutes.
 *
 * @param inputMinutes - Total minutes to convert
 * @returns An object with the hour and minute components
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
 * @param date - The date to extract hours and minutes from
 * @returns An object with the hour and minute components
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
 * @returns The corresponding MinuteOfDay value
 */
export function toMinuteOfDay(hour: Hours, minute: Minutes): MinuteOfDay {
  return asMinuteOfDay(hour * 60 + minute);
}

/**
 * Creates a new date with the time set to the given minute of the day.
 *
 * @param minuteOfDay - The minute of the day (0-1439)
 * @param day - Optional base date to use (defaults to the current date)
 * @returns A Date with the time set to the specified minute of day
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
 * @param date - The date to convert
 * @returns The MinuteOfDay for the given date
 */
export function dateToMinuteOfDay(date: Date): MinuteOfDay {
  const { hour, minute } = dateToHoursAndMinutes(date);
  return toMinuteOfDay(hour, minute);
}

/**
 * Converts the input minutes to a valid MinuteOfDay by wrapping around the day boundary.
 *
 * @param minutes - The minutes value to convert
 * @returns A MinuteOfDay value (0-1439)
 */
export function asMinuteOfDay(minutes: Minutes): MinuteOfDay {
  return Math.max(0, minutes % MINUTES_IN_DAY);
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
 * @param input - The hours and minutes to format
 * @returns A human-readable string representation
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
