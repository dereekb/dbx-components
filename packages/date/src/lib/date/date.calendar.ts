import { parseISO8601DayStringToUTCDate, type ISO8601DayString } from '@dereekb/util';
import { Expose } from 'class-transformer';
import { IsEnum } from 'class-validator';
import { daysToMinutes } from './date';
import { DateDurationSpan } from './date.duration';
import { dateTimezoneUtcNormal } from './date.timezone';

/**
 * Distinguishes between time-based calendar events and all-day/multi-day events.
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
 * A calendar entry that combines a {@link DateDurationSpan} with a {@link CalendarDateType} to distinguish
 * between timed events and all-day/multi-day events.
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

/**
 * Configuration for creating calendar dates with timezone handling.
 */
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

/**
 * Creates a {@link CalendarDate} from a day string and optional multi-day span.
 */
export type CalendarDateFactory = (day: ISO8601DayString, days?: number) => CalendarDate;

/**
 * Creates a {@link CalendarDateFactory} that produces all-day calendar events with timezone-aware start times.
 *
 * The factory converts an ISO 8601 day string to a UTC date, then applies timezone normalization
 * so the resulting `startsAt` represents the correct moment for the target timezone.
 *
 * @param config - optional timezone configuration
 * @returns a factory function that creates CalendarDate objects
 *
 * @example
 * ```ts
 * const factory = calendarDateFactory({ timezone: 'America/Denver' });
 * const event = factory('2024-01-15', 3);
 * // event.type === CalendarDateType.DAYS
 * // event.duration === daysToMinutes(3)
 * ```
 */
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

/**
 * Convenience function that creates a single all-day {@link CalendarDate} with optional timezone.
 *
 * Shorthand for creating a factory and immediately invoking it.
 *
 * @param day - ISO 8601 day string (e.g. '2024-01-15')
 * @param days - number of days the event spans
 * @param timezone - IANA timezone string, false for UTC, or undefined for system timezone
 * @returns a CalendarDate with type DAYS
 *
 * @example
 * ```ts
 * const event = calendarDate('2024-01-15', 1, 'America/Denver');
 * // event.type === CalendarDateType.DAYS
 * ```
 */
export function calendarDate(day: ISO8601DayString, days?: number, timezone?: string | false): CalendarDate {
  return calendarDateFactory({ timezone })(day, days);
}

/**
 * Wraps an existing {@link DateDurationSpan} as a time-based {@link CalendarDate}.
 *
 * @param dateDurationSpan - the duration span to wrap
 * @returns a CalendarDate with type TIME
 *
 * @example
 * ```ts
 * const span: DateDurationSpan = { startsAt: new Date(), duration: 60 };
 * const event = calendarDateForDateDurationSpan(span);
 * // event.type === CalendarDateType.TIME
 * ```
 */
export function calendarDateForDateDurationSpan(dateDurationSpan: DateDurationSpan): CalendarDate {
  return {
    type: CalendarDateType.TIME,
    ...dateDurationSpan
  };
}
