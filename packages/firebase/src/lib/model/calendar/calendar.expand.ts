import { type Maybe, type Minutes, type TimezoneString, filterUniqueFunction } from '@dereekb/util';
import { type DateRange, DateRRuleUtility, sortByDateFunction } from '@dereekb/date';
import { addMinutes } from 'date-fns';
import { type Calendar, type CalendarEventItem, type CalendarRecurringEventItem } from './calendar';
import { CALENDAR_OCCURRENCE_KEY_SEPARATOR, type CalendarOccurrenceKey } from './calendar.id';
import { calendarEventItemCalendarDate, calendarEventItemEndDate, calendarEventItemExceptionDateSet, calendarEventItemTimezone } from './calendar.util';

/**
 * @module calendar.expand
 *
 * The ONE occurrence expansion, shared by ICS generation and by the future dbx-calendar adapter.
 *
 * Deliberately free of any Angular dependency, and deliberately not duplicated on the server: an adapter
 * that expanded recurrences differently from the publisher would render a calendar that disagrees with the
 * ".ics" the same model produced.
 *
 * The adapter is then one line —
 * `{ id: o.key, start: o.startsAt, end: o.endsAt, allDay: o.allDay, title: o.item.n, meta: o }` — which is a
 * `CalendarEvent<CalendarEventOccurrence>` and feeds straight into `prepareAndSortCalendarEvents()`.
 */

/**
 * A single resolved occurrence of a calendar event.
 *
 * A one-off event yields exactly one occurrence; a recurring event yields one per instance of its series
 * within the expansion range.
 */
export interface CalendarEventOccurrence {
  /**
   * The event this occurrence came from.
   */
  readonly item: CalendarEventItem | CalendarRecurringEventItem;
  /**
   * Stable identifier for this occurrence.
   *
   * The event's id for a one-off; the id plus the occurrence's unix seconds for a recurrence. Stability is
   * what keeps a published VEVENT's UID the same across republishes, which is what makes a subscriber update
   * the event it holds rather than create a duplicate.
   */
  readonly key: CalendarOccurrenceKey;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly durationMinutes: Minutes;
  readonly allDay: boolean;
  readonly timezone: TimezoneString;
  readonly recurring: boolean;
}

/**
 * Builds the {@link CalendarOccurrenceKey} for a single occurrence of a recurring event.
 *
 * @param item - The recurring event.
 * @param startsAt - The occurrence's start instant.
 * @returns The occurrence key.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function calendarRecurringEventOccurrenceKey(item: Pick<CalendarEventItem, 'id'>, startsAt: Date): CalendarOccurrenceKey {
  return `${item.id}${CALENDAR_OCCURRENCE_KEY_SEPARATOR}${Math.floor(startsAt.getTime() / 1000)}`;
}

/**
 * Input for {@link expandCalendarEvents}.
 */
export interface ExpandCalendarEventsInput {
  readonly calendar: Pick<Calendar, 'tz' | 'e' | 'r'>;
  /**
   * The window to expand within.
   *
   * REQUIRED: a forever recurrence has no other bound, and expanding one without a range throws.
   */
  readonly range: DateRange;
  /**
   * Whether one-off events are included. Defaults to true.
   */
  readonly includeOneOffEvents?: Maybe<boolean>;
  /**
   * Whether recurring events are included. Defaults to true.
   */
  readonly includeRecurringEvents?: Maybe<boolean>;
  /**
   * Caps how many occurrences a single recurring event may contribute.
   */
  readonly maxOccurrencesPerEvent?: Maybe<number>;
}

/**
 * Sorts occurrences ascending by their start instant.
 */
const sortCalendarEventOccurrencesFunction = sortByDateFunction<CalendarEventOccurrence>((x) => x.startsAt);

/**
 * Keeps only the first occurrence carrying a given key.
 */
const filterUniqueCalendarEventOccurrencesFunction = filterUniqueFunction<CalendarEventOccurrence, CalendarOccurrenceKey>((x) => x.key);

/**
 * Expands a calendar's events into concrete occurrences within a range.
 *
 * One-off events are included when their span OVERLAPS the range. Recurring events are expanded through
 * `DateRRuleUtility`, whose `exclude` slot consumes the event's `rex` exception dates with no extra code;
 * note that it matches an occurrence by its START, so a recurrence instance that began before the range and
 * runs into it is not included.
 *
 * @param input - The calendar, the range, and optional filters.
 * @returns The occurrences, ascending by start instant and unique by key.
 * @throws {Error} If a forever recurrence is expanded without a range.
 *
 * @example
 * ```ts
 * const occurrences = expandCalendarEvents({ calendar, range: { start: from, end: to } });
 * ```
 */
export function expandCalendarEvents(input: ExpandCalendarEventsInput): CalendarEventOccurrence[] {
  const { calendar, range, includeOneOffEvents, includeRecurringEvents, maxOccurrencesPerEvent } = input;
  const calendarTimezone = calendar.tz;
  const occurrences: CalendarEventOccurrence[] = [];

  if (includeOneOffEvents !== false) {
    (calendar.e ?? []).forEach((item) => {
      const endsAt = calendarEventItemEndDate(item);

      if (item.sa <= range.end && endsAt >= range.start) {
        occurrences.push({
          item,
          key: item.id,
          startsAt: item.sa,
          endsAt,
          durationMinutes: item.dur,
          allDay: item.ad === true,
          timezone: calendarEventItemTimezone(item, calendarTimezone),
          recurring: false
        });
      }
    });
  }

  if (includeRecurringEvents !== false) {
    (calendar.r ?? []).forEach((item) => {
      const timezone = calendarEventItemTimezone(item, calendarTimezone);

      const expansion = DateRRuleUtility.expand({
        instanceFrom: {
          rruleLines: item.rr,
          options: {
            date: calendarEventItemCalendarDate(item),
            timezone,
            exclude: calendarEventItemExceptionDateSet(item)
          }
        },
        // a COPY: DateRRuleInstance.expand() normalizes the range IN PLACE, so a shared object would be
        // progressively shifted by every event it was passed to
        range: range ? { start: new Date(range.start), end: new Date(range.end) } : (range as DateRange)
      });

      const dates = maxOccurrencesPerEvent == null ? expansion.dates : expansion.dates.slice(0, maxOccurrencesPerEvent);

      dates.forEach((date) => {
        occurrences.push({
          item,
          key: calendarRecurringEventOccurrenceKey(item, date.startsAt),
          startsAt: date.startsAt,
          endsAt: addMinutes(date.startsAt, item.dur),
          durationMinutes: item.dur,
          allDay: item.ad === true,
          timezone,
          recurring: true
        });
      });
    });
  }

  return filterUniqueCalendarEventOccurrencesFunction(occurrences.sort(sortCalendarEventOccurrencesFunction));
}
