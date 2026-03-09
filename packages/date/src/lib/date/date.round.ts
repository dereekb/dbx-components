import { roundNumberUpToStep } from '@dereekb/util';
import { set, getMinutes, addHours } from 'date-fns';

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
 * @param date - the date to round
 * @param round - step and rounding configuration
 * @returns the rounded date
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
 * @param date - the date to round
 * @param round - which components to clear
 * @returns the rounded date
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
 * Rounds the date's minutes up to the nearest multiple of the given step.
 *
 * If the step is 1 or less, the date is returned unchanged. If rounding pushes minutes to 60, the hour is incremented.
 *
 * @param date - the date to round
 * @param step - the minute step to round to
 * @returns the date with minutes rounded to the nearest step
 *
 * @example
 * ```ts
 * const result = roundToMinuteSteps(new Date('2024-01-01T10:07:00Z'), 15);
 * // result minutes will be 15 (next step above 7)
 * ```
 */
export function roundToMinuteSteps(date: Date, step: number): Date {
  // Only steps of 1 or more are allowed.
  if (step <= 1) {
    return date;
  }

  const minute = getMinutes(date);
  const roundedValue = roundNumberUpToStep(minute, step);

  if (roundedValue !== minute) {
    if (roundedValue === 60) {
      // Round the hour up.
      date = addHours(set(date, { minutes: 0 }), 1);
    } else {
      date = set(date, { minutes: roundedValue });
    }
  }

  return date;
}
