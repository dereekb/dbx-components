import { roundNumberUpToStep } from "@dereekb/util";
import { set, getMinutes, addHours } from "date-fns";

export interface RoundTimeDown {
  roundDownToDay?: boolean;
  roundDownToMinute?: boolean;
}

export interface StepRoundDateTimeDown extends RoundTimeDown {
  step?: number;
  roundToSteps?: boolean;
}

// MARK: Rounding
export function roundDateTimeDownToSteps(date: Date, round: StepRoundDateTimeDown): Date {
  const { step, roundToSteps = true } = round;

  if (roundToSteps) {
    date = roundToMinuteSteps(date, step ?? 1);
  }

  return roundDateTimeDown(date, round);
}

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
 * Rounds the current number of minutes on the date to the nearest step.
 */
export function roundToMinuteSteps(date: Date, step: number): Date {

  // Only steps of 1 or more are allowed.
  if (step <= 1) {
    return date;
  }

  const minute = getMinutes(date);
  const roundedValue = roundNumberUpToStep(minute, step);

  if (roundedValue !== minute) {
    if (roundedValue === 60) {  // Round the hour up.
      date = addHours(set(date, { minutes: 0 }), 1);
    } else {
      date = set(date, { minutes: roundedValue });
    }
  }

  return date;
}
