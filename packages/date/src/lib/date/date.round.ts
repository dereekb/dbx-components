import { dateToMinuteOfDay, MINUTES_IN_DAY, minutesIncrementConverter } from '@dereekb/util';
import { set, addMinutes } from 'date-fns';

/**
 * Options for rounding a date's time components down.
 */
export interface RoundTimeDown {
  roundDownToDay?: boolean;
  roundDownToMinute?: boolean;
}

/**
 * Options for rounding a date to configured minute steps, then optionally rounding time components down.
 */
export interface StepRoundDateTimeDown extends RoundTimeDown {
  step?: number;
  roundToSteps?: boolean;
}

// MARK: Rounding
/**
 * Rounds the date's minutes to the nearest step, then rounds remaining time components down.
 *
 * @param date - Moment to round.
 * @param round - Step size and trailing-component clearing options.
 * @returns Rounded copy of the input moment.
 *
 * @example
 * ```ts
 * // Round to 15-minute steps and clear seconds
 * const rounded = roundDateTimeDownToSteps(new Date('2024-01-01T10:07:30Z'), { step: 15 });
 * // rounded minutes will be 15 (rounded up from 7), seconds cleared
 * ```
 */
export function roundDateTimeDownToSteps(date: Date, round: StepRoundDateTimeDown): Date {
  const { step, roundToSteps = true } = round;

  if (roundToSteps) {
    date = roundToMinuteSteps(date, step ?? 1);
  }

  return roundDateTimeDown(date, round);
}

/**
 * Clears time components of the date based on rounding options (e.g. seconds/milliseconds, or hours/minutes for day rounding).
 *
 * @param date - Moment to round.
 * @param round - Selection of time components to clear.
 * @returns Rounded copy of the input moment.
 *
 * @example
 * ```ts
 * const result = roundDateTimeDown(new Date('2024-01-01T10:07:30.500Z'), { roundDownToMinute: true });
 * // seconds and milliseconds are set to 0
 * ```
 */
export function roundDateTimeDown(date: Date, round: RoundTimeDown): Date {
  const { roundDownToDay = false, roundDownToMinute = true } = round;

  let rounding = {};

  if (roundDownToMinute) {
    rounding = {
      ...rounding,
      seconds: 0,
      milliseconds: 0
    };
  }

  if (roundDownToDay) {
    rounding = {
      ...rounding,
      hours: 0,
      minutes: 0
    };
  }

  return set(date, rounding);
}

/**
 * Rounds the date up to the next multiple of the given step of minutes, counted from the start of the date's day in the system timezone.
 *
 * If the step is 1 or less, the date is returned unchanged. Rounding uses the whole minute of the day, and the seconds and milliseconds are not changed. If rounding passes the end of the day, the result is the start of the next day.
 *
 * Steps that evenly divide an hour (5, 15, 30, etc.) align to each hour. Other steps align to the start of the day, so a 45 minute step produces 00:00, 00:45, 01:30, etc.
 *
 * @param date - Moment to round.
 * @param step - Granularity of minutes the result must align to.
 * @returns Copy of the moment with minutes snapped to the requested step.
 * @throws {Error} If the step is greater than 1 and is not an integer.
 *
 * @example
 * ```ts
 * const result = roundToMinuteSteps(new Date('2024-01-01T10:07:00Z'), 15);
 * // result minutes will be 15 (next step above 7)
 * ```
 */
export function roundToMinuteSteps(date: Date, step: number): Date {
  let result = date;

  // Only steps of 1 or more are allowed.
  if (step > 1) {
    const minuteOfDay = dateToMinuteOfDay(date);
    const roundedValue = Math.min(minutesIncrementConverter({ increment: step, round: 'ceil' }).round(minuteOfDay), MINUTES_IN_DAY);

    if (roundedValue !== minuteOfDay) {
      result = addMinutes(date, roundedValue - minuteOfDay);
    }
  }

  return result;
}
