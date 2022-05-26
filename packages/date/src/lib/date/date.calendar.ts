import { ISO8601DayString } from '@dereekb/util';
import { Expose } from 'class-transformer';
import { daysToMinutes } from './date';
import { DateDurationSpan } from './date.duration';
import { dateStringToDate } from './date.format';

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

export class CalendarDateUtility {
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
