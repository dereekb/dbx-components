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

export const FRACTIONAL_HOURS_PRECISION_FUNCTION = cutValueToPrecisionFunction(3);

/**
 * Converts the number of minnutes to a fractional hour.
 *
 * Minutes are rounded down.
 */
export function minutesToFractionalHours(minutes: Minutes): FractionalHour {
  return FRACTIONAL_HOURS_PRECISION_FUNCTION(Math.floor(minutes) / MINUTES_IN_HOUR);
}

/**
 * Converts the fractional hour to a minute.
 */
export function fractionalHoursToMinutes(hours: FractionalHour): Minutes {
  return Math.round(hours * MINUTES_IN_HOUR);
}

/**
 * Rounds the input hour to the nearest FractionalHour.
 *
 * @param hour
 * @returns
 */
export function hourToFractionalHour(hour: Hours): FractionalHour {
  return minutesToFractionalHours(fractionalHoursToMinutes(hour));
}

export interface ComputeFractionalHour {
  readonly minutes?: Maybe<Minutes>;
  readonly hours?: Maybe<Hours>;
}

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
 * Returns true if the input valuer is a MinuteOfDay.
 *
 * @param input
 * @returns
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
 * @param inputMinutes
 * @returns
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
 * Reads the hour and minutes of the Date.
 *
 * @param date
 * @returns
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
 * @param hour
 * @param minute
 * @returns
 */
export function toMinuteOfDay(hour: Hours, minute: Minutes): MinuteOfDay {
  return asMinuteOfDay(hour * 60 + minute);
}

/**
 * Creates a new date from the minute of the day.
 *
 * @param minuteOfDay
 * @param day
 * @returns
 */
export function dateFromMinuteOfDay(minuteOfDay: Minutes | MinuteOfDay, day?: Date) {
  const date = day || new Date();
  const { hour, minute } = minutesToHoursAndMinutes(asMinuteOfDay(minuteOfDay));
  date.setHours(hour, minute, 0, 0);
  return date;
}

/**
 * Converts a Date to a MinuteOfDay.
 *
 * @param date
 * @returns
 */
export function dateToMinuteOfDay(date: Date): MinuteOfDay {
  const { hour, minute } = dateToHoursAndMinutes(date);
  return toMinuteOfDay(hour, minute);
}

/**
 * Converts the input minutes to a MinuteOfDay.
 *
 * @param minutes
 * @returns
 */
export function asMinuteOfDay(minutes: Minutes): MinuteOfDay {
  return Math.max(0, minutes % MINUTES_IN_DAY);
}

/**
 * Returns a string that represents the input hours and minutes.
 *
 * Examples:
 * - {} -> ''
 * - { hour: 1, minute: 30 } -> "1 hour and 30 minutes"
 * - { hour: 1 } -> "1 hour"
 * - { minute: 30 } -> "30 minutes"
 *
 * @param input
 * @returns
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
