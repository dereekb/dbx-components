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
 * Returns the day of the week for the input day.
 *
 * Equivalent to date.getDay()
 *
 * @param date
 * @returns
 */
export function dayOfWeek(date: Date) {
  return date.getDay() as DayOfWeek;
}

/**
 * Decision function that checks whether or not the input DayOfWeek or the DayOfWeek for the input Date is in the set.
 */
export type IsInAllowedDaysOfWeekSetDecisionFunction = IsInSetDecisionFunction<Date | DayOfWeek, DayOfWeek>;

/**
 * Creates a DecisionFunction that checks whether or not the input day or days of
 *
 * @param allowedDaysOfWeek
 * @returns
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
 * @param startingOn
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
 * Returns an array of strinsg with each day of the week named.
 *
 * @returns
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

export function daysOfWeekNameMap(transform?: DayOfWeekNamesTransformConfig): Map<DayOfWeek, string> {
  const dayOfWeekNames = getDaysOfWeekNames(true, transform);
  return new Map<DayOfWeek, string>(dayOfWeekNames.map((x, i) => [i as DayOfWeek, x]));
}

export type DayOfWeekNameFunction = (dayOfWeek: DayOfWeek) => string;

export function daysOfWeekNameFunction(transform?: DayOfWeekNamesTransformConfig): DayOfWeekNameFunction {
  const map = daysOfWeekNameMap(transform);
  return (dayOfWeek: DayOfWeek) => map.get(dayOfWeek) ?? 'UNKNOWN';
}

export function getDayTomorrow(day: DayOfWeek): DayOfWeek {
  return getNextDay(day, 1);
}

export function getDayYesterday(day: DayOfWeek): DayOfWeek {
  return getPreviousDay(day, 1);
}

export function getDayOffset(day: DayOfWeek, days: number): DayOfWeek {
  if (days === 0) {
    return day;
  } else if (days < 0) {
    return getPreviousDay(day, days);
  } else {
    return getNextDay(day, days);
  }
}

export function getPreviousDay(day: DayOfWeek, days: number = 1): DayOfWeek {
  const offset = Math.abs(days) % 7;
  const cap = 7 - offset;
  return getNextDay(day, cap);
}

export function getNextDay(day: DayOfWeek, days: number = 1): DayOfWeek {
  let result = ((day + days) % 7) as DayOfWeek;

  if (result < 0) {
    result = (7 + result) as DayOfWeek;
  }

  return result;
}
