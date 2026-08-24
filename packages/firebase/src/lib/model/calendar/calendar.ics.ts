import { type Maybe, type Minutes, type WebsiteUrl, UTC_TIMEZONE_STRING, isConsideredUtcTimezoneString } from '@dereekb/util';
import { CalendarDateType, type DateRange, type ICalendar, type ICalendarEvent, type ICalendarEventStatus, type ICalendarExtraProperty, type ICalendarIcsString, type ICalendarRecurrence, type ICalendarSerializeConfig, type ICalendarUidFactory, iCalendarEventForCalendarDate, iCalendarRecurrenceForRRuleLines, iCalendarToIcsString, iCalendarUidFactory, iCalendarWithDerivedTimezones } from '@dereekb/date';
import { addDays, subDays } from 'date-fns';
import { type Calendar, type CalendarEventItem, type CalendarRecurringEventItem } from './calendar';
import { type CalendarExtensionData, type CalendarId } from './calendar.id';
import { type CalendarIcsRecurrenceMode, DEFAULT_CALENDAR_ICS_EXPANSION_FUTURE_DAYS, DEFAULT_CALENDAR_ICS_EXPANSION_PAST_DAYS, DEFAULT_CALENDAR_ICS_RECURRENCE_MODE, type CalendarTypeConfig } from './calendar.type';
import { type CalendarEventOccurrence, expandCalendarEvents } from './calendar.expand';
import { calendarEventItemCalendarDate, calendarEventItemExceptionDateSet, calendarEventItemTimezone } from './calendar.util';

/**
 * @module calendar.ics
 *
 * Renders a {@link Calendar} into the `@dereekb/date` iCalendar model, and from there into an ICS document.
 *
 * The output is DETERMINISTIC for a fixed `now`: every property is emitted in a fixed order and no object
 * keys are iterated in insertion order. That is what lets the publisher content-hash a payload and skip a
 * no-op upload, and it is why the processor passes `now: calendar.uat` rather than `new Date()` — DTSTAMP
 * then moves only when the content moves.
 */

/**
 * The "X-" prefix an extension property name is given when it does not already carry one.
 */
export const CALENDAR_EXTENSION_PROPERTY_PREFIX = 'X-';

/**
 * Converts a calendar's or event's {@link CalendarExtensionData} into iCalendar extra properties.
 *
 * The stored key is a SUFFIX: it is uppercased, stripped of anything outside `[A-Z0-9-]`, and prefixed with
 * "X-" unless it already carries one. Storing the suffix and prefixing at emit time is what makes it
 * impossible for stored data to shadow a standard property such as SUMMARY.
 *
 * Emitted in sorted key order, because `Record` iteration order is insertion order and data round-tripped
 * through Firestore carries no insertion-order guarantee.
 *
 * @param data - The stored extension data.
 * @returns The extra properties. Empty when nothing survives sanitization.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function calendarExtensionDataToICalendarExtraProperties(data: Maybe<CalendarExtensionData>): ICalendarExtraProperty[] {
  const result: ICalendarExtraProperty[] = [];

  if (data != null) {
    Object.keys(data)
      .sort()
      .forEach((key) => {
        const value = data[key];

        if (typeof value === 'string') {
          const sanitized = key.toUpperCase().replaceAll(/[^A-Z0-9-]/g, '');

          if (sanitized.length > 0) {
            const name = sanitized.startsWith(CALENDAR_EXTENSION_PROPERTY_PREFIX) ? sanitized : `${CALENDAR_EXTENSION_PROPERTY_PREFIX}${sanitized}`;
            result.push({ name, value });
          }
        }
      });
  }

  return result;
}

/**
 * Configuration for {@link calendarToICalendar}.
 */
export interface CalendarToICalendarConfig {
  /**
   * The calendar's document id. Used as the UID prefix, so an event's UID stays stable across republishes.
   */
  readonly calendarId: CalendarId;
  /**
   * How recurring events are emitted. Defaults to {@link DEFAULT_CALENDAR_ICS_RECURRENCE_MODE}.
   */
  readonly recurrenceMode?: Maybe<CalendarIcsRecurrenceMode>;
  /**
   * The window expanded in `expand` mode. Defaults to the type config's expansion days around `now`.
   */
  readonly expansionRange?: Maybe<DateRange>;
  /**
   * The UID factory. Built from {@link domain} when absent.
   */
  readonly uidFactory?: Maybe<ICalendarUidFactory>;
  /**
   * The domain the UID factory is built around. REQUIRED when no {@link uidFactory} is supplied — the
   * factory deliberately has no random fallback, since a UID that changes between publishes makes every
   * client create a duplicate event rather than update the one it holds.
   */
  readonly domain?: Maybe<string>;
  /**
   * The canonical URL the feed is published at. Emitted as SOURCE.
   */
  readonly source?: Maybe<WebsiteUrl>;
  /**
   * Emitted as REFRESH-INTERVAL / X-PUBLISHED-TTL.
   */
  readonly refreshInterval?: Maybe<Minutes>;
  /**
   * Whether a VTIMEZONE is derived for every zone the events reference. Defaults to true.
   *
   * Free to leave on: the deriver returns the calendar unchanged when no zoned value exists.
   */
  readonly deriveTimezones?: Maybe<boolean>;
  /**
   * The reference instant for the default expansion window. Defaults to the current time.
   */
  readonly now?: Maybe<Date>;
}

/**
 * Builds the {@link CalendarToICalendarConfig} fragment a {@link CalendarTypeConfig} contributes.
 *
 * @param config - The calendar type config.
 * @returns The ICS emission settings it carries.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function calendarTypeConfigIcsConfig(config: CalendarTypeConfig): Pick<CalendarToICalendarConfig, 'recurrenceMode' | 'refreshInterval'> {
  return {
    recurrenceMode: config.icsRecurrenceMode,
    refreshInterval: config.refreshInterval
  };
}

/**
 * Returns the expansion window used by `expand` mode when the caller supplies none.
 *
 * @param config - The calendar type config carrying the window sizes.
 * @param now - The reference instant.
 * @returns The expansion range.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function calendarTypeConfigIcsExpansionRange(config: CalendarTypeConfig, now: Date): DateRange {
  return {
    start: subDays(now, config.icsExpansionPastDays ?? DEFAULT_CALENDAR_ICS_EXPANSION_PAST_DAYS),
    end: addDays(now, config.icsExpansionFutureDays ?? DEFAULT_CALENDAR_ICS_EXPANSION_FUTURE_DAYS)
  };
}

/**
 * The descriptive properties every VEVENT inherits from its stored event item.
 */
function calendarEventItemDescriptiveProperties(item: CalendarEventItem): Omit<ICalendarEvent, 'uid' | 'start' | 'end' | 'duration'> {
  const extraProperties = calendarExtensionDataToICalendarExtraProperties(item.x);

  return {
    summary: item.n,
    description: item.d,
    location: item.l,
    url: item.u,
    status: item.st as Maybe<ICalendarEventStatus>,
    categories: item.ca,
    sequence: item.q,
    created: item.cat,
    lastModified: item.uat,
    ...(extraProperties.length ? { extraProperties } : undefined)
  };
}

/**
 * Builds the {@link ICalendarRecurrence} for a recurring event, merging its `rex` exception dates into
 * whatever the stored rule already carries.
 */
function calendarRecurringEventItemICalendarRecurrence(item: CalendarRecurringEventItem): ICalendarRecurrence {
  const recurrence = iCalendarRecurrenceForRRuleLines(item.rr);
  const exceptionDates = calendarEventItemExceptionDateSet(item)
    .valuesArray()
    .sort((a, b) => a.getTime() - b.getTime())
    .map((at) => ({ type: 'utc' as const, at }));

  return exceptionDates.length ? { ...recurrence, exceptionDates: [...(recurrence.exceptionDates ?? []), ...exceptionDates] } : recurrence;
}

/**
 * Converts a {@link Calendar} into the format-agnostic {@link ICalendar} model.
 *
 * - A ONE-OFF event goes through `iCalendarEventForCalendarDate()`, which already handles the all-day
 *   `VALUE=DATE` path and RFC 5545 3.8.2.2's exclusive DTEND. A consequence worth knowing: a TIMED one-off
 *   emits UTC instants, because that factory has no zoned path. Deliberate — it needs no VTIMEZONE and reads
 *   identically in every client.
 * - A RECURRING event gets a ZONED DTSTART when its timezone is not UTC. This is where it matters: a
 *   `FREQ=WEEKLY;BYDAY=MO` rule anchored to a UTC instant drifts across a DST boundary. It carries
 *   `duration`, never `end` — the serializer prefers DTEND when both are set, and a per-series DTEND is wrong.
 * - `recurrenceMode: 'expand'` instead emits one VEVENT per occurrence, each carrying a RECURRENCE-ID.
 *
 * @param calendar - The calendar to render.
 * @param config - The UID source, recurrence mode, and feed metadata.
 * @returns The iCalendar model.
 * @throws {Error} If neither a uidFactory nor a domain is supplied.
 *
 * @example
 * ```ts
 * const iCalendar = calendarToICalendar(calendar, { calendarId, domain: 'example.com' });
 * ```
 */
export function calendarToICalendar(calendar: Calendar, config: CalendarToICalendarConfig): ICalendar {
  const { calendarId, uidFactory: inputUidFactory, domain, source, refreshInterval, deriveTimezones, expansionRange, now: inputNow } = config;
  const now = inputNow ?? new Date();
  const recurrenceMode = config.recurrenceMode ?? DEFAULT_CALENDAR_ICS_RECURRENCE_MODE;

  if (!inputUidFactory && !domain) {
    throw new Error('calendarToICalendar() requires either a uidFactory or a domain. There is no random UID fallback: a UID that changes between publishes makes clients duplicate events instead of updating them.');
  }

  const uidFactory = inputUidFactory ?? iCalendarUidFactory({ domain: domain as string, prefix: calendarId });
  const events: ICalendarEvent[] = [];

  (calendar.e ?? []).forEach((item) => {
    events.push(
      iCalendarEventForCalendarDate(calendarEventItemCalendarDate(item), {
        ...calendarEventItemDescriptiveProperties(item),
        uid: uidFactory(item.id),
        timezone: calendarEventItemTimezone(item, calendar.tz)
      })
    );
  });

  if (recurrenceMode === 'expand') {
    const range = expansionRange ?? { start: subDays(now, DEFAULT_CALENDAR_ICS_EXPANSION_PAST_DAYS), end: addDays(now, DEFAULT_CALENDAR_ICS_EXPANSION_FUTURE_DAYS) };
    const occurrences = expandCalendarEvents({ calendar, range, includeOneOffEvents: false });

    occurrences.forEach((occurrence) => events.push(calendarEventOccurrenceToICalendarEvent(occurrence, uidFactory)));
  } else {
    (calendar.r ?? []).forEach((item) => {
      const timezone = calendarEventItemTimezone(item, calendar.tz);
      const zoned = !item.ad && !isConsideredUtcTimezoneString(timezone);

      events.push({
        ...calendarEventItemDescriptiveProperties(item),
        uid: uidFactory(item.id),
        start: zoned ? { type: 'zoned', at: item.sa, timezone } : { type: 'utc', at: item.sa },
        duration: item.dur,
        recurrence: calendarRecurringEventItemICalendarRecurrence(item)
      });
    });
  }

  const extraProperties = calendarExtensionDataToICalendarExtraProperties(calendar.x);

  const result: ICalendar = {
    name: calendar.n,
    description: calendar.d,
    color: calendar.c,
    timezone: calendar.tz,
    refreshInterval,
    source,
    events,
    ...(extraProperties.length ? { extraProperties } : undefined)
  };

  return deriveTimezones === false ? result : iCalendarWithDerivedTimezones(result);
}

/**
 * Converts a single expanded occurrence into a discrete VEVENT.
 *
 * Used by `expand` mode, and by any caller that wants one event per occurrence rather than a rule.
 *
 * @param occurrence - The occurrence to render.
 * @param uidFactory - The UID factory, fed the occurrence's stable key.
 * @returns The event.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function calendarEventOccurrenceToICalendarEvent(occurrence: CalendarEventOccurrence, uidFactory: ICalendarUidFactory): ICalendarEvent {
  const { item, startsAt, durationMinutes, allDay, timezone, recurring } = occurrence;
  const uid = uidFactory(occurrence.key);

  const event = iCalendarEventForCalendarDate(
    { type: allDay ? CalendarDateType.DAYS : CalendarDateType.TIME, startsAt, duration: durationMinutes },
    {
      ...calendarEventItemDescriptiveProperties(item),
      uid,
      timezone
    }
  );

  return recurring ? { ...event, recurrenceId: allDay ? event.start : { type: 'utc', at: startsAt } } : event;
}

/**
 * Renders a {@link Calendar} into a complete, folded, CRLF-terminated ICS document.
 *
 * @param calendar - The calendar to render.
 * @param config - The iCalendar config plus serialization settings (notably `now`, the DTSTAMP source).
 * @returns The ICS document.
 *
 * @example
 * ```ts
 * const ics = calendarToIcsString(calendar, { calendarId, domain: 'example.com', now: calendar.uat });
 * ```
 */
export function calendarToIcsString(calendar: Calendar, config: CalendarToICalendarConfig & ICalendarSerializeConfig): ICalendarIcsString {
  return iCalendarToIcsString(calendarToICalendar(calendar, config), config);
}

/**
 * The timezone treated as "no zone needed" when deciding whether a recurring DTSTART must be zoned.
 */
export const CALENDAR_ICS_DEFAULT_TIMEZONE = UTC_TIMEZONE_STRING;
