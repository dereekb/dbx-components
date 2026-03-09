import { type Maybe } from '../value';
import { type IsInSetDecisionFunction, isInSetDecisionFunction } from '../set/set.decision';

export type Sunday = 0;
export type Monday = 1;
export type Tuesday = 2;
export type Wednesday = 3;
export type Thusrsday = 4;
export type Friday = 5;
export type Saturday = 6;

/**
 * Values that correspond to each day of the week.
 */
export type DayOfWeek = Sunday | Monday | Tuesday | Wednesday | Thusrsday | Friday | Saturday | Sunday;

/**
 * Returns the day of the week for the input date.
 *
 * Equivalent to date.getDay().
 *
 * @param date - The date to get the day of week for
 * @returns The DayOfWeek value (0=Sunday through 6=Saturday)
 */
export function dayOfWeek(date: Date) {
  return date.getDay() as DayOfWeek;
}

/**
 * Decision function that checks whether or not the input DayOfWeek or the DayOfWeek for the input Date is in the set.
 */
export type IsInAllowedDaysOfWeekSetDecisionFunction = IsInSetDecisionFunction<Date | DayOfWeek, DayOfWeek>;

/**
 * Creates a DecisionFunction that checks whether the input day or Date falls within the allowed days of the week.
 *
 * @param allowedDaysOfWeek - Set of allowed DayOfWeek values
 * @returns A decision function that checks membership in the allowed set
 */
export function isInAllowedDaysOfWeekSet(allowedDaysOfWeek: Set<DayOfWeek>): IsInAllowedDaysOfWeekSetDecisionFunction {
  return isInSetDecisionFunction<Date | DayOfWeek, DayOfWeek>(allowedDaysOfWeek, (x) => {
    return typeof x === 'number' ? x : dayOfWeek(x);
  });
}

/**
 * Returns all days of the week starting from the given day up to the specified number of days.
 *
 * Returns 7 days by default.
 *
 * @param startingOn - The day to start from (defaults to Sunday)
 * @param maxDays - Maximum number of days to return (defaults to 7)
 * @returns An array of DayOfWeek values
 */
export function daysOfWeekArray(startingOn: DayOfWeek = Day.SUNDAY, maxDays: number = 7): DayOfWeek[] {
  const days: DayOfWeek[] = [];

  let day: DayOfWeek = startingOn;

  while (days.length < maxDays) {
    days.push(day);

    if (day === Day.SATURDAY) {
      day = Day.SUNDAY;
    } else {
      day += 1;
    }
  }

  return days;
}

/**
 * Enum for the days of the week.
 */
export enum Day {
  SUNDAY = 0,
  MONDAY = 1,
  TUESDAY = 2,
  WEDNESDAY = 3,
  THURSDAY = 4,
  FRIDAY = 5,
  SATURDAY = 6
}

/**
 * Object containing the name of every day and whether they're true/false.
 */
export interface EnabledDays {
  sunday: boolean;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
}

/**
 * Creates an EnabledDays object from an iterable of Day enum values.
 *
 * @param input - Iterable of Day values to mark as enabled
 * @returns An EnabledDays object with the specified days set to true
 */
export function enabledDaysFromDaysOfWeek(input: Maybe<Iterable<Day>>): EnabledDays {
  const set = new Set(input);

  return {
    sunday: set.has(Day.SUNDAY),
    monday: set.has(Day.MONDAY),
    tuesday: set.has(Day.TUESDAY),
    wednesday: set.has(Day.WEDNESDAY),
    thursday: set.has(Day.THURSDAY),
    friday: set.has(Day.FRIDAY),
    saturday: set.has(Day.SATURDAY)
  };
}

/**
 * Converts an EnabledDays object to an array of Day enum values.
 *
 * @param input - The EnabledDays object to convert
 * @returns An array of Day values for all enabled days
 */
export function daysOfWeekFromEnabledDays(input: Maybe<EnabledDays>): Day[] {
  const daysOfWeek: Day[] = [];

  if (input) {
    if (input.sunday) {
      daysOfWeek.push(Day.SUNDAY);
    }

    if (input.monday) {
      daysOfWeek.push(Day.MONDAY);
    }

    if (input.tuesday) {
      daysOfWeek.push(Day.TUESDAY);
    }

    if (input.wednesday) {
      daysOfWeek.push(Day.WEDNESDAY);
    }

    if (input.thursday) {
      daysOfWeek.push(Day.THURSDAY);
    }

    if (input.friday) {
      daysOfWeek.push(Day.FRIDAY);
    }

    if (input.saturday) {
      daysOfWeek.push(Day.SATURDAY);
    }
  }

  return daysOfWeek;
}

/**
 * Configuration for transforming day-of-week name strings.
 */
export interface DayOfWeekNamesTransformConfig {
  /**
   * Whether or not to abbreviate the day names.
   *
   * I.E. Mon, Tue, etc.
   */
  abbreviation?: boolean;
  /**
   * Whether or not to uppercase the days.
   *
   * I.E. MONDAY, TUE, etc.
   */
  uppercase?: boolean;
}

/**
 * Returns an array of strings with each day of the week named.
 *
 * @param sundayFirst - If true (default), Sunday is the first day; otherwise Monday is first
 * @param transform - Optional configuration for abbreviation and casing
 * @returns Array of day name strings
 */
export function getDaysOfWeekNames(sundayFirst = true, transform?: DayOfWeekNamesTransformConfig): string[] {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const sunday = 'Sunday';

  let dayOfWeekNames: string[];

  if (sundayFirst) {
    dayOfWeekNames = [sunday, ...days];
  } else {
    dayOfWeekNames = [...days, sunday];
  }

  if (transform != null) {
    if (transform.abbreviation) {
      dayOfWeekNames = dayOfWeekNames.map((x) => x.slice(0, 3));
    }

    if (transform.uppercase) {
      dayOfWeekNames = dayOfWeekNames.map((x) => x.toUpperCase());
    }
  }

  return dayOfWeekNames;
}

/**
 * Creates a Map from DayOfWeek values to their string names.
 *
 * @param transform - Optional configuration for abbreviation and casing
 * @returns A Map from DayOfWeek to name string
 */
export function daysOfWeekNameMap(transform?: DayOfWeekNamesTransformConfig): Map<DayOfWeek, string> {
  const dayOfWeekNames = getDaysOfWeekNames(true, transform);
  return new Map<DayOfWeek, string>(dayOfWeekNames.map((x, i) => [i as DayOfWeek, x]));
}

/**
 * Function that returns the name string for a given DayOfWeek.
 */
export type DayOfWeekNameFunction = (dayOfWeek: DayOfWeek) => string;

/**
 * Creates a function that returns the name for a given DayOfWeek.
 *
 * @param transform - Optional configuration for abbreviation and casing
 * @returns A function that maps DayOfWeek values to name strings
 */
export function daysOfWeekNameFunction(transform?: DayOfWeekNamesTransformConfig): DayOfWeekNameFunction {
  const map = daysOfWeekNameMap(transform);
  return (dayOfWeek: DayOfWeek) => map.get(dayOfWeek) ?? 'UNKNOWN';
}

/**
 * Returns the DayOfWeek for the day after the given day.
 *
 * @param day - The starting day
 * @returns The next day of the week
 */
export function getDayTomorrow(day: DayOfWeek): DayOfWeek {
  return getNextDay(day, 1);
}

/**
 * Returns the DayOfWeek for the day before the given day.
 *
 * @param day - The starting day
 * @returns The previous day of the week
 */
export function getDayYesterday(day: DayOfWeek): DayOfWeek {
  return getPreviousDay(day, 1);
}

/**
 * Returns the DayOfWeek offset by the given number of days (positive = forward, negative = backward).
 *
 * @param day - The starting day
 * @param days - The number of days to offset (positive or negative)
 * @returns The resulting DayOfWeek
 */
export function getDayOffset(day: DayOfWeek, days: number): DayOfWeek {
  if (days === 0) {
    return day;
  } else if (days < 0) {
    return getPreviousDay(day, days);
  } else {
    return getNextDay(day, days);
  }
}

/**
 * Returns the DayOfWeek that is the given number of days before the input day.
 *
 * @param day - The starting day
 * @param days - The number of days to go back (defaults to 1)
 * @returns The resulting DayOfWeek
 */
export function getPreviousDay(day: DayOfWeek, days: number = 1): DayOfWeek {
  const offset = Math.abs(days) % 7;
  const cap = 7 - offset;
  return getNextDay(day, cap);
}

/**
 * Returns the DayOfWeek that is the given number of days after the input day.
 *
 * @param day - The starting day
 * @param days - The number of days to advance (defaults to 1)
 * @returns The resulting DayOfWeek
 */
export function getNextDay(day: DayOfWeek, days: number = 1): DayOfWeek {
  let result = ((day + days) % 7) as DayOfWeek;

  if (result < 0) {
    result = (7 + result) as DayOfWeek;
  }

  return result;
}
