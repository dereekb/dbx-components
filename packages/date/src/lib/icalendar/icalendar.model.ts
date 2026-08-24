import { type EmailAddress, type ISO8601DayString, type LatLngPoint, type Maybe, type Minutes, type TimezoneString, type WebsiteUrl } from '@dereekb/util';
import { type RRuleLineString } from '../rrule/date.rrule.parse';
import { type ICalendarAlarmAction, type ICalendarAttendeeRole, type ICalendarCalAddress, type ICalendarClassification, type ICalendarEventStatus, type ICalendarMethod, type ICalendarParticipationStatus, type ICalendarProductId, type ICalendarTransparency, type ICalendarUid } from './icalendar';

/**
 * A moment in an iCalendar model, discriminated by how it should be serialized.
 *
 * The union exists so the serializer never has to guess timezone intent: a bare Date cannot express
 * "all-day", and a Date paired with a separate optional timezone field invites the caller to set one and
 * forget the other.
 */
export type ICalendarDateTimeValue = ICalendarUtcDateTime | ICalendarZonedDateTime | ICalendarDateOnly;

/**
 * An absolute instant, serialized as a UTC DATE-TIME. I.E. "DTSTART:20260315T140000Z".
 *
 * The default representation for a timed event: it needs no VTIMEZONE and is unambiguous in every client.
 */
export interface ICalendarUtcDateTime {
  readonly type: 'utc';
  /**
   * The instant.
   */
  readonly at: Date;
}

/**
 * A wall clock in a named zone, serialized as a DATE-TIME with a TZID parameter.
 * I.E. "DTSTART;TZID=America/Denver:20260315T090000".
 *
 * A calendar carrying a zoned value should also carry the matching VTIMEZONE component.
 */
export interface ICalendarZonedDateTime {
  readonly type: 'zoned';
  /**
   * The instant. Its wall clock in {@link timezone} is what gets rendered.
   */
  readonly at: Date;
  /**
   * The zone whose wall clock is rendered, and the value of the emitted TZID parameter.
   */
  readonly timezone: TimezoneString;
}

/**
 * A floating calendar day with no time and no zone, serialized as "VALUE=DATE".
 * I.E. "DTSTART;VALUE=DATE:20260315".
 *
 * Holds a day string rather than a Date on purpose: an all-day event is genuinely a calendar day with no
 * instant, and carrying a Date is what produces off-by-one-day bugs under a non-UTC system timezone.
 */
export interface ICalendarDateOnly {
  readonly type: 'date';
  /**
   * The calendar day. I.E. "2026-03-15".
   */
  readonly day: ISO8601DayString;
}

/**
 * Optional recurrence properties passed through to the serializer verbatim.
 *
 * NOTE: the default authoring path in this library expands recurrences into discrete events rather than
 * emitting a recurrence rule, since a published feed gets no chance to correct a client's misinterpretation
 * before the next poll (which is 12-24 hours away). These properties exist for callers that need them.
 */
export interface ICalendarRecurrence {
  /**
   * Raw RRULE value-part strings. I.E. "FREQ=WEEKLY;BYDAY=MO,WE".
   */
  readonly rules?: Maybe<readonly RRuleLineString[]>;
  /**
   * EXDATE values, excluded from the recurrence set.
   */
  readonly exceptionDates?: Maybe<readonly ICalendarDateTimeValue[]>;
  /**
   * RDATE values, added to the recurrence set.
   */
  readonly additionalDates?: Maybe<readonly ICalendarDateTimeValue[]>;
}

/**
 * A participant in an event.
 */
export interface ICalendarAttendee {
  /**
   * The attendee's CAL-ADDRESS. A bare email address is given the "mailto:" scheme.
   */
  readonly address: EmailAddress | ICalendarCalAddress;
  /**
   * Display name, emitted as the CN parameter.
   */
  readonly name?: Maybe<string>;
  /**
   * Emitted as the ROLE parameter.
   */
  readonly role?: Maybe<ICalendarAttendeeRole>;
  /**
   * Emitted as the PARTSTAT parameter.
   */
  readonly participationStatus?: Maybe<ICalendarParticipationStatus>;
  /**
   * Emitted as the RSVP parameter.
   */
  readonly rsvp?: Maybe<boolean>;
}

/**
 * The organizer of an event. Same shape as an attendee minus the attendee-only parameters.
 */
export type ICalendarOrganizer = Omit<ICalendarAttendee, 'role' | 'participationStatus' | 'rsvp'>;

/**
 * A VALARM sub-component of an event.
 *
 * NOTE: Google Calendar ignores VALARM on a subscribed calendar; Apple Calendar honours it.
 */
export interface ICalendarAlarm {
  /**
   * The action the alarm performs. I.E. DISPLAY.
   */
  readonly action: ICalendarAlarmAction;
  /**
   * TRIGGER expressed as an offset from the event's start. Negative fires before the event.
   *
   * Mutually exclusive with {@link triggerAt}; this one wins when both are set.
   */
  readonly triggerMinutesRelativeToStart?: Maybe<Minutes>;
  /**
   * TRIGGER expressed as an absolute instant.
   */
  readonly triggerAt?: Maybe<Date>;
  /**
   * Alarm text. Required by RFC 5545 for a DISPLAY or EMAIL alarm; defaulted at serialize time when omitted.
   */
  readonly description?: Maybe<string>;
  /**
   * Subject line of an EMAIL alarm.
   */
  readonly summary?: Maybe<string>;
}

/**
 * A single transition within a {@link ICalendarTimezone}, emitted as a STANDARD or DAYLIGHT sub-component.
 */
export interface ICalendarTimezoneTransition {
  /**
   * Whether the transition moves the zone into daylight saving time.
   */
  readonly daylight: boolean;
  /**
   * The instant the transition takes effect. Rendered as the transition's local wall clock DTSTART.
   */
  readonly startsAt: Date;
  /**
   * The UTC offset in effect immediately before the transition.
   */
  readonly offsetFrom: Minutes;
  /**
   * The UTC offset in effect from the transition onward.
   */
  readonly offsetTo: Minutes;
  /**
   * TZNAME. The zone's abbreviation while this offset is in effect. I.E. "MDT".
   */
  readonly name?: Maybe<string>;
}

/**
 * A VTIMEZONE component. Usually derived from an IANA zone rather than hand-written.
 */
export interface ICalendarTimezone {
  /**
   * The TZID this component defines. I.E. "America/Denver".
   */
  readonly timezone: TimezoneString;
  /**
   * The transitions within the covered window. RFC 5545 requires at least one.
   */
  readonly transitions: readonly ICalendarTimezoneTransition[];
}

/**
 * A VEVENT.
 */
export interface ICalendarEvent {
  /**
   * REQUIRED, and stable across publishes. See {@link ICalendarUid}.
   */
  readonly uid: ICalendarUid;
  /**
   * REQUIRED. DTSTART.
   */
  readonly start: ICalendarDateTimeValue;
  /**
   * DTEND. Exclusive: for an all-day event this is the day AFTER the last day (RFC 5545 3.8.2.2).
   *
   * A VEVENT may carry a DTEND or a DURATION but not both; when both are set here, this one wins.
   */
  readonly end?: Maybe<ICalendarDateTimeValue>;
  /**
   * DURATION, used only when {@link end} is absent.
   */
  readonly duration?: Maybe<Minutes>;
  readonly summary?: Maybe<string>;
  readonly description?: Maybe<string>;
  readonly location?: Maybe<string>;
  readonly geo?: Maybe<LatLngPoint>;
  readonly url?: Maybe<WebsiteUrl>;
  /**
   * STATUS. CANCELLED is how a feed communicates a deletion to clients that already hold the event.
   */
  readonly status?: Maybe<ICalendarEventStatus>;
  readonly transparency?: Maybe<ICalendarTransparency>;
  readonly classification?: Maybe<ICalendarClassification>;
  readonly categories?: Maybe<readonly string[]>;
  readonly priority?: Maybe<number>;
  /**
   * SEQUENCE. Defaults to 0, and is only emitted when non-zero.
   *
   * Clients compare it against the sequence they already hold to decide whether a same-UID event is newer,
   * so it must be bumped on every semantic change to a published event.
   */
  readonly sequence?: Maybe<number>;
  readonly created?: Maybe<Date>;
  readonly lastModified?: Maybe<Date>;
  /**
   * DTSTAMP for this event, overriding the calendar-level default.
   */
  readonly timestamp?: Maybe<Date>;
  readonly organizer?: Maybe<ICalendarOrganizer>;
  readonly attendees?: Maybe<readonly ICalendarAttendee[]>;
  /**
   * Optional recurrence pass-through. Not used by the default authoring path.
   */
  readonly recurrence?: Maybe<ICalendarRecurrence>;
  /**
   * RECURRENCE-ID, identifying which instance of a recurrence set this event overrides.
   */
  readonly recurrenceId?: Maybe<ICalendarDateTimeValue>;
  readonly alarms?: Maybe<readonly ICalendarAlarm[]>;
}

/**
 * A VCALENDAR. The typed domain model the serializers consume.
 *
 * This is the format-agnostic layer: an ICS emitter, and any future jCal (RFC 7265) or xCal (RFC 6321)
 * emitter, all consume the same model through the same component tree.
 */
export interface ICalendar {
  /**
   * PRODID. Defaults to ICALENDAR_DEFAULT_PRODUCT_ID at serialize time.
   */
  readonly productId?: Maybe<ICalendarProductId>;
  /**
   * Display name of the feed. Emitted as both the RFC 7986 NAME and the non-standard X-WR-CALNAME.
   */
  readonly name?: Maybe<string>;
  /**
   * Emitted as both DESCRIPTION and X-WR-CALDESC.
   */
  readonly description?: Maybe<string>;
  /**
   * RFC 7986 COLOR, as a CSS3 color name.
   */
  readonly color?: Maybe<string>;
  /**
   * RFC 7986 REFRESH-INTERVAL, also emitted as X-PUBLISHED-TTL.
   *
   * ADVISORY ONLY. Google Calendar re-fetches a subscribed feed every ~12-24 hours regardless of this value
   * and offers no manual refresh; Apple lets the user choose. Feed freshness is not tunable from the producer.
   */
  readonly refreshInterval?: Maybe<Minutes>;
  /**
   * RFC 7986 SOURCE. The canonical URL the feed is published at.
   */
  readonly source?: Maybe<WebsiteUrl>;
  readonly url?: Maybe<WebsiteUrl>;
  /**
   * Default zone hint for clients, emitted as the non-standard X-WR-TIMEZONE.
   */
  readonly timezone?: Maybe<TimezoneString>;
  /**
   * iTIP METHOD. OMITTED by default: a METHOD makes the payload an iTIP message (RFC 5546), which some
   * clients treat as an invitation import rather than a subscription.
   */
  readonly method?: Maybe<ICalendarMethod>;
  /**
   * The events in the feed.
   */
  readonly events: readonly ICalendarEvent[];
  /**
   * VTIMEZONE components. Required when any event carries a zoned date-time.
   */
  readonly timezones?: Maybe<readonly ICalendarTimezone[]>;
}

/**
 * Configuration applied when converting an {@link ICalendar} into a component tree.
 */
export interface ICalendarSerializeConfig {
  /**
   * The moment used for DTSTAMP on any event that does not carry its own timestamp.
   *
   * Injectable so serialized output is deterministic in tests. Defaults to the current time.
   */
  readonly now?: Maybe<Date>;
  /**
   * PRODID override. Defaults to ICALENDAR_DEFAULT_PRODUCT_ID.
   */
  readonly productId?: Maybe<ICalendarProductId>;
}
