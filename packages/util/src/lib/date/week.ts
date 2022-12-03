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
  return Math.abs((day + days) % 7) as DayOfWeek;
}
