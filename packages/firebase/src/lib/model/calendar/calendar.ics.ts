import { type ArrayOrValue, type Maybe, type Minutes, type TimezoneString, type WebsiteUrl, asArray, UTC_TIMEZONE_STRING, isConsideredUtcTimezoneString } from '@dereekb/util';
import {
  CalendarDateType,
  type DateRange,
  type ICalendar,
  type ICalendarAttendee,
  type ICalendarAttendeeRole,
  type ICalendarEvent,
  type ICalendarEventStatus,
  type ICalendarExtraProperty,
  type ICalendarIcsString,
  type ICalendarMethod,
  type ICalendarOrganizer,
  type ICalendarParticipationStatus,
  type ICalendarRecurrence,
  type ICalendarSerializeConfig,
  type ICalendarUid,
  type ICalendarUidFactory,
  iCalendarEventForCalendarDate,
  iCalendarRecurrenceForRRuleLines,
  iCalendarToIcsString,
  iCalendarUidFactory,
  iCalendarWithDerivedTimezones
} from '@dereekb/date';
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
 * The identity a single event item is rendered under.
 */
export interface CalendarEventItemToICalendarEventConfig {
  /**
   * The event's UID. Produced by the feed's UID factory, so a VEVENT rendered here and the same event in
   * the published feed are the same event to a client rather than two.
   */
  readonly uid: ICalendarUid;
  /**
   * The timezone the event's wall clock is anchored to. Normally `calendarEventItemTimezone(item, calendar.tz)`.
   */
  readonly timezone: TimezoneString;
}

/**
 * Renders a ONE-OFF event item as a VEVENT.
 *
 * Goes through `iCalendarEventForCalendarDate()`, which already handles the all-day `VALUE=DATE` path and
 * RFC 5545 3.8.2.2's exclusive DTEND. A consequence worth knowing: a TIMED one-off emits UTC instants,
 * because that factory has no zoned path. Deliberate -- it needs no VTIMEZONE and reads identically in
 * every client.
 *
 * @param item - The stored event item.
 * @param config - The UID and timezone to render it under.
 * @returns The event.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function calendarEventItemToICalendarEvent(item: CalendarEventItem, config: CalendarEventItemToICalendarEventConfig): ICalendarEvent {
  const { uid, timezone } = config;

  return iCalendarEventForCalendarDate(calendarEventItemCalendarDate(item), {
    ...calendarEventItemDescriptiveProperties(item),
    uid,
    timezone
  });
}

/**
 * Renders a RECURRING event item as a single rule-bearing VEVENT.
 *
 * Gets a ZONED DTSTART when its timezone is not UTC. This is where it matters: a `FREQ=WEEKLY;BYDAY=MO`
 * rule anchored to a UTC instant drifts across a DST boundary. It carries `duration`, never `end` -- the
 * serializer prefers DTEND when both are set, and a per-series DTEND is wrong.
 *
 * @param item - The stored recurring event item.
 * @param config - The UID and timezone to render it under.
 * @returns The event.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function calendarRecurringEventItemToICalendarEvent(item: CalendarRecurringEventItem, config: CalendarEventItemToICalendarEventConfig): ICalendarEvent {
  const { uid, timezone } = config;
  const zoned = !item.ad && !isConsideredUtcTimezoneString(timezone);

  return {
    ...calendarEventItemDescriptiveProperties(item),
    uid,
    start: zoned ? { type: 'zoned', at: item.sa, timezone } : { type: 'utc', at: item.sa },
    duration: item.dur,
    recurrence: calendarRecurringEventItemICalendarRecurrence(item)
  };
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
    events.push(calendarEventItemToICalendarEvent(item, { uid: uidFactory(item.id), timezone: calendarEventItemTimezone(item, calendar.tz) }));
  });

  if (recurrenceMode === 'expand') {
    const range = expansionRange ?? { start: subDays(now, DEFAULT_CALENDAR_ICS_EXPANSION_PAST_DAYS), end: addDays(now, DEFAULT_CALENDAR_ICS_EXPANSION_FUTURE_DAYS) };
    const occurrences = expandCalendarEvents({ calendar, range, includeOneOffEvents: false });

    occurrences.forEach((occurrence) => events.push(calendarEventOccurrenceToICalendarEvent(occurrence, uidFactory)));
  } else {
    (calendar.r ?? []).forEach((item) => {
      events.push(calendarRecurringEventItemToICalendarEvent(item, { uid: uidFactory(item.id), timezone: calendarEventItemTimezone(item, calendar.tz) }));
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

// MARK: Invites
/**
 * The iTIP method an invite carries when its caller names none.
 *
 * REQUEST rather than PUBLISH deliberately: REQUEST is the only method that can ever carry a real RSVP, so
 * starting here makes adding accept/decline later a parameter change rather than a redesign. The cost is
 * that REQUEST needs an ATTENDEE matching the recipient's own address, which is what forces a sending
 * service to emit one request per recipient rather than one batched request.
 */
export const DEFAULT_CALENDAR_INVITE_METHOD: ICalendarMethod = 'REQUEST';

/**
 * The PARTSTAT an invite attendee is given when its caller names none.
 *
 * Pre-accepting suppresses the RSVP prompt in most clients while still getting auto-add and a proper inline
 * invitation card. A strong hint rather than a guarantee -- some clients render RSVP buttons regardless.
 */
export const DEFAULT_CALENDAR_INVITE_ATTENDEE_PARTICIPATION_STATUS: ICalendarParticipationStatus = 'ACCEPTED';

/**
 * The ROLE an invite attendee is given when its caller names none.
 */
export const DEFAULT_CALENDAR_INVITE_ATTENDEE_ROLE: ICalendarAttendeeRole = 'REQ-PARTICIPANT';

/**
 * Configuration for {@link calendarEventItemToInviteICalendar} / {@link calendarEventItemToInviteIcsString}.
 */
export interface CalendarEventItemToInviteConfig {
  /**
   * The event to invite to. A recurring item (one carrying `rr`) is emitted as a single rule-bearing VEVENT,
   * exactly as the feed emits it in `rule` mode.
   */
  readonly item: CalendarEventItem | CalendarRecurringEventItem;
  /**
   * The calendar's document id. The UID prefix, and it MUST be the same id the feed publishes the event
   * under -- see {@link uidFactory}.
   */
  readonly calendarId: CalendarId;
  /**
   * The iTIP method. Defaults to {@link DEFAULT_CALENDAR_INVITE_METHOD}.
   *
   * CANCEL emits a CANCELLED status and, absent an explicit {@link sequence}, bumps the sequence -- see
   * {@link sequence}.
   */
  readonly method?: Maybe<ICalendarMethod>;
  /**
   * Who the invite is from.
   *
   * Point this at a mailbox that ARCHIVES OR DISCARDS: we are the ORGANIZER, so inbound `METHOD:REPLY`
   * mail is possible even when every attendee is sent `RSVP=FALSE`, and it will arrive at this address.
   */
  readonly organizer: ICalendarOrganizer;
  /**
   * Who the invite is to. Defaults are applied per attendee -- see
   * {@link DEFAULT_CALENDAR_INVITE_ATTENDEE_PARTICIPATION_STATUS} and
   * {@link DEFAULT_CALENDAR_INVITE_ATTENDEE_ROLE}.
   *
   * A REQUEST is only rendered inline by a client that finds ITS OWN address here, which is why an invite
   * is built per recipient rather than once per notification.
   */
  readonly attendees: ArrayOrValue<ICalendarAttendee>;
  /**
   * SEQUENCE override.
   *
   * Defaults to the item's own revision counter (`q`), which the Calendar model already bumps on every
   * change a subscriber can observe -- so an updated event re-sent under the same UID outranks the copy the
   * client holds. Load-bearing: an update with a stale or absent SEQUENCE is SILENTLY IGNORED.
   *
   * For CANCEL the default is `q + 1` instead, so a cancellation always outranks the last REQUEST sent for
   * the same revision. Pass an explicit value when the caller owns its own sequence source.
   */
  readonly sequence?: Maybe<number>;
  /**
   * The UID factory.
   *
   * MUST be the FEED's factory (or an identical one built from the feed's {@link domain}). A second UID
   * scheme means a recipient who is both subscribed to the feed and holding the invite sees the event
   * twice, and no update or cancellation reaches the invited copy.
   */
  readonly uidFactory?: Maybe<ICalendarUidFactory>;
  /**
   * The domain the UID factory is built around. REQUIRED when no {@link uidFactory} is supplied.
   */
  readonly domain?: Maybe<string>;
  /**
   * The timezone the event's wall clock is anchored to. Normally the parent calendar's `tz`. Defaults to
   * {@link CALENDAR_ICS_DEFAULT_TIMEZONE}.
   */
  readonly timezone?: Maybe<TimezoneString>;
  /**
   * Optional display name for the enclosing VCALENDAR.
   */
  readonly name?: Maybe<string>;
}

/**
 * Applies the invite defaults to an attendee.
 *
 * @param attendee - The caller's attendee.
 * @returns The attendee, with any unspecified invite parameters defaulted.
 */
function calendarInviteAttendee(attendee: ICalendarAttendee): ICalendarAttendee {
  return {
    role: DEFAULT_CALENDAR_INVITE_ATTENDEE_ROLE,
    participationStatus: DEFAULT_CALENDAR_INVITE_ATTENDEE_PARTICIPATION_STATUS,
    rsvp: false,
    ...attendee
  };
}

/**
 * Builds the single-event iTIP {@link ICalendar} an emailed invite carries.
 *
 * The counterpart to {@link calendarToICalendar}: same model, same UID scheme, one event, and a METHOD.
 * The METHOD is what makes it an iTIP message (RFC 5546) rather than a feed -- which is right for an
 * emailed attachment and wrong for a subscription, hence the two entry points.
 *
 * @param config - The event, the parties, and the UID source.
 * @returns The iCalendar model.
 * @throws {Error} If neither a uidFactory nor a domain is supplied.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function calendarEventItemToInviteICalendar(config: CalendarEventItemToInviteConfig): ICalendar {
  const { item, calendarId, organizer, attendees, uidFactory: inputUidFactory, domain, name, sequence: inputSequence } = config;
  const method = config.method ?? DEFAULT_CALENDAR_INVITE_METHOD;
  const timezone = config.timezone ?? CALENDAR_ICS_DEFAULT_TIMEZONE;
  const cancelling = method === 'CANCEL';

  if (!inputUidFactory && !domain) {
    throw new Error('calendarEventItemToInviteICalendar() requires either a uidFactory or a domain, and it must be the same one the feed publishes this event under.');
  }

  const uidFactory = inputUidFactory ?? iCalendarUidFactory({ domain: domain as string, prefix: calendarId });
  const uid = uidFactory(item.id);
  const storedSequence = item.q ?? 0;
  const sequence = inputSequence ?? (cancelling ? storedSequence + 1 : storedSequence);
  const recurring = (item as CalendarRecurringEventItem).rr != null;
  const base = recurring ? calendarRecurringEventItemToICalendarEvent(item as CalendarRecurringEventItem, { uid, timezone }) : calendarEventItemToICalendarEvent(item, { uid, timezone });

  const event: ICalendarEvent = {
    ...base,
    sequence,
    organizer,
    attendees: asArray(attendees).map(calendarInviteAttendee),
    // a CANCEL that does not also say CANCELLED leaves clients that only read STATUS holding a live event
    ...(cancelling ? { status: 'CANCELLED' as ICalendarEventStatus } : undefined)
  };

  return iCalendarWithDerivedTimezones({ name, timezone, method, events: [event] });
}

/**
 * Renders the emailed iTIP invite for a single event as a complete, folded, CRLF-terminated ICS document.
 *
 * The output is used directly as the calendar MIME part's data. The part must ALSO be typed
 * `text/calendar; method=<method>; charset=utf-8` (see `iCalendarITipContentType()`) -- a client decides
 * whether to auto-process from the part type, and the same bytes typed as an octet stream are a paperclip.
 *
 * @param config - The event, the parties, the UID source, and the DTSTAMP source.
 * @returns The ICS document.
 *
 * @example
 * ```ts
 * const ics = calendarEventItemToInviteIcsString({
 *   item,
 *   calendarId,
 *   domain: 'example.com',
 *   organizer: { address: 'calendar@example.com', name: 'Example' },
 *   attendees: { address: recipientEmail },
 *   now: item.uat
 * });
 * ```
 */
export function calendarEventItemToInviteIcsString(config: CalendarEventItemToInviteConfig & ICalendarSerializeConfig): ICalendarIcsString {
  return iCalendarToIcsString(calendarEventItemToInviteICalendar(config), config);
}
