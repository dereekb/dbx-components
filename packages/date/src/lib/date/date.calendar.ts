import { ISO8601DayString } from '@dereekb/util';
import { Expose } from 'class-transformer';
import { IsEnum } from 'class-validator';
import { daysToMinutes } from './date';
import { DateDurationSpan } from './date.duration';
import { parseISO8601DayStringToUTCDate } from './date.format';
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
  @IsEnum(CalendarDateType)
  type: CalendarDateType = CalendarDateType.TIME;

  constructor(template?: CalendarDate) {
    super(template);

    if (template != null) {
      this.type = template.type;
    }
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
    const date = parseISO8601DayStringToUTCDate(day);
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

export function calendarDateForDateDurationSpan(dateDurationSpan: DateDurationSpan): CalendarDate {
  return {
    type: CalendarDateType.TIME,
    ...dateDurationSpan
  };
}
