import { cutValueToPrecisionFunction } from '../number/round';
import { type Maybe } from '../value/maybe.type';
import { type Hours, type Minutes, MINUTES_IN_HOUR } from './date';

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
