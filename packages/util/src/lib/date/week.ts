import { Maybe } from '../value';

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

/**
 * Returns an array of strinsg with each day of the week named.
 *
 * @returns
 */
export function getDaysOfWeekNames(sundayFirst = true) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const sunday = 'Sunday';

  if (sundayFirst) {
    return [sunday, ...days];
  } else {
    return [...days, sunday];
  }
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
