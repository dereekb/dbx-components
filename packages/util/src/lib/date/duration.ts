import { type Milliseconds, MS_IN_DAY, MS_IN_HOUR, MS_IN_MINUTE, MS_IN_SECOND, MS_IN_WEEK } from './date';
import { type HoursAndMinutes, minutesToHoursAndMinutes } from './hour';

// MARK: TimeUnit
/**
 * A unit of time duration.
 *
 * - `'ms'` — milliseconds
 * - `'s'` — seconds
 * - `'min'` — minutes
 * - `'h'` — hours
 * - `'d'` — days
 * - `'w'` — weeks
 */
export type TimeUnit = 'ms' | 's' | 'min' | 'h' | 'd' | 'w';

/**
 * All time units ordered from smallest to largest.
 */
export const ALL_TIME_UNITS: readonly TimeUnit[] = ['ms', 's', 'min', 'h', 'd', 'w'];

/**
 * Human-readable labels for each time unit.
 */
export const TIME_UNIT_LABEL_MAP: Readonly<Record<TimeUnit, string>> = {
  ms: 'Milliseconds',
  s: 'Seconds',
  min: 'Minutes',
  h: 'Hours',
  d: 'Days',
  w: 'Weeks'
};

/**
 * Short labels for each time unit.
 */
export const TIME_UNIT_SHORT_LABEL_MAP: Readonly<Record<TimeUnit, string>> = {
  ms: 'ms',
  s: 'sec',
  min: 'min',
  h: 'hr',
  d: 'day',
  w: 'wk'
};

/**
 * Maps each TimeUnit to the number of milliseconds in one of that unit.
 */
const TIME_UNIT_MS_MAP: Readonly<Record<TimeUnit, Milliseconds>> = {
  ms: 1,
  s: MS_IN_SECOND,
  min: MS_IN_MINUTE,
  h: MS_IN_HOUR,
  d: MS_IN_DAY,
  w: MS_IN_WEEK
};

/**
 * Converts an amount in the given time unit to milliseconds.
 *
 * @param amount - The numeric amount in the given unit
 * @param unit - The time unit of the amount
 * @returns The equivalent number of milliseconds
 *
 * @example
 * ```typescript
 * timeUnitToMilliseconds(2, 'h'); // 7200000
 * timeUnitToMilliseconds(30, 'min'); // 1800000
 * ```
 */
export function timeUnitToMilliseconds(amount: number, unit: TimeUnit): Milliseconds {
  return amount * TIME_UNIT_MS_MAP[unit];
}

/**
 * Converts milliseconds to an amount in the given time unit.
 *
 * @param ms - The number of milliseconds
 * @param unit - The target time unit
 * @returns The equivalent amount in the target unit
 *
 * @example
 * ```typescript
 * millisecondsToTimeUnit(7200000, 'h'); // 2
 * millisecondsToTimeUnit(1800000, 'min'); // 30
 * ```
 */
export function millisecondsToTimeUnit(ms: Milliseconds, unit: TimeUnit): number {
  return ms / TIME_UNIT_MS_MAP[unit];
}

/**
 * Converts a duration amount from one time unit to another.
 *
 * Goes through milliseconds as an intermediary for the conversion.
 *
 * @param amount - The numeric amount in the source unit
 * @param fromUnit - The source time unit
 * @param toUnit - The target time unit
 * @returns The equivalent amount in the target unit
 *
 * @example
 * ```typescript
 * convertTimeDuration(2, 'h', 'min'); // 120
 * convertTimeDuration(1, 'd', 'h'); // 24
 * convertTimeDuration(500, 'ms', 's'); // 0.5
 * ```
 */
export function convertTimeDuration(amount: number, fromUnit: TimeUnit, toUnit: TimeUnit): number {
  if (fromUnit === toUnit) {
    return amount;
  }

  return millisecondsToTimeUnit(timeUnitToMilliseconds(amount, fromUnit), toUnit);
}

// MARK: TimeDuration
/**
 * A structured time duration with an amount and unit.
 */
export interface TimeDuration {
  readonly amount: number;
  readonly unit: TimeUnit;
}

/**
 * Converts a TimeDuration to milliseconds.
 *
 * @param duration - The duration to convert
 * @returns The equivalent number of milliseconds
 *
 * @example
 * ```typescript
 * timeDurationToMilliseconds({ amount: 5, unit: 'min' }); // 300000
 * ```
 */
export function timeDurationToMilliseconds(duration: TimeDuration): Milliseconds {
  return timeUnitToMilliseconds(duration.amount, duration.unit);
}

/**
 * Converts a TimeDuration to an HoursAndMinutes object.
 *
 * First converts to total minutes, then splits into hours and minutes.
 *
 * @param duration - The duration to convert
 * @returns An HoursAndMinutes object
 *
 * @example
 * ```typescript
 * timeDurationToHoursAndMinutes({ amount: 90, unit: 'min' }); // { hour: 1, minute: 30 }
 * timeDurationToHoursAndMinutes({ amount: 2.5, unit: 'h' }); // { hour: 2, minute: 30 }
 * ```
 */
export function timeDurationToHoursAndMinutes(duration: TimeDuration): HoursAndMinutes {
  const totalMinutes = convertTimeDuration(duration.amount, duration.unit, 'min');
  return minutesToHoursAndMinutes(Math.round(totalMinutes));
}

/**
 * Converts an HoursAndMinutes object to a total number in the specified time unit.
 *
 * @param hoursAndMinutes - The hours and minutes to convert
 * @param toUnit - The target time unit
 * @returns The equivalent amount in the target unit
 *
 * @example
 * ```typescript
 * hoursAndMinutesToTimeUnit({ hour: 1, minute: 30 }, 'min'); // 90
 * hoursAndMinutesToTimeUnit({ hour: 2, minute: 0 }, 'h'); // 2
 * ```
 */
export function hoursAndMinutesToTimeUnit(hoursAndMinutes: HoursAndMinutes, toUnit: TimeUnit): number {
  const totalMinutes = hoursAndMinutes.hour * 60 + hoursAndMinutes.minute;
  return convertTimeDuration(totalMinutes, 'min', toUnit);
}
