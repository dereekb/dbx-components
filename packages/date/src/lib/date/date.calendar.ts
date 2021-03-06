import { ISO8601DayString } from '@dereekb/util';
import { Expose } from 'class-transformer';
import { daysToMinutes } from './date';
import { DateDurationSpan } from './date.duration';
import { dateStringToDate, dateStringToUTCDate } from './date.format';
import { dateTimezoneUtcNormal } from './date.timezone';

/**
 * CalendarDateType
 */
export enum CalendarDateType {
  /**
   * Event starts at a specific time and lasts for a certain duration.
   */
  TIME = 'time',
  /**
   * Event is specifically for a number of days. Duration is still tracked in minutes.
   */
  DAYS = 'days'
}

/**
 * Represents a date on a calendar.
 */
export interface CalendarDate extends DateDurationSpan {
  type: CalendarDateType;
}

export class CalendarDate extends DateDurationSpan {
  /**
   * The type of event date.
   */
  @Expose()
  type: CalendarDateType = CalendarDateType.TIME;

  constructor(template: CalendarDate) {
    super(template);
    this.type = template.type;
  }
}

export interface CalendarDateConfig {
  /**
   * The timezone to generate the calendar day on.
   *
   * If not defined, will use the current system timezone.
   * If defined, will apply the target timezone's offset.
   * If false, will be generated in UTC.
   */
  timezone?: string | false;
}

export type CalendarDateFactory = (day: ISO8601DayString, days?: number) => CalendarDate;

export function calendarDateFactory(config?: CalendarDateConfig): CalendarDateFactory {
  const normalConfig = config?.timezone === undefined ? { useSystemTimezone: true } : { timezone: config.timezone ? config.timezone : undefined };
  const normal = dateTimezoneUtcNormal(normalConfig);

  return (day: ISO8601DayString, days?: number) => {
    const date = dateStringToUTCDate(day);
    const startsAt = normal.targetDateToBaseDate(date);

    return {
      type: CalendarDateType.DAYS,
      startsAt,
      duration: daysToMinutes(days)
    };
  };
}

export function calendarDate(day: ISO8601DayString, days?: number, timezone?: string | false): CalendarDate {
  return calendarDateFactory({ timezone })(day, days);
}

export class CalendarDateUtility {
  /**
   * @Deprecated use calendarDate() instead
   */
  static calendarDateForDay(day: ISO8601DayString, days?: number): CalendarDate {
    return {
      type: CalendarDateType.DAYS,
      startsAt: dateStringToDate(day),
      duration: daysToMinutes(days)
    };
  }

  static calendarDateForDateDurationSpan(dateDurationSpan: DateDurationSpan): CalendarDate {
    return {
      type: CalendarDateType.TIME,
      ...dateDurationSpan
    };
  }
}
