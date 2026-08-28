import { type SuggestedString } from '@dereekb/util';

/**
 * The name of an iCalendar component. I.E. VCALENDAR, VEVENT, VALARM, VTIMEZONE, STANDARD, DAYLIGHT.
 *
 * https://datatracker.ietf.org/doc/html/rfc5545#section-3.6
 *
 * @semanticType
 * @semanticTopic string
 * @semanticTopic dereekb-date:icalendar
 */
export type ICalendarComponentName = SuggestedString<'VCALENDAR' | 'VEVENT' | 'VALARM' | 'VTIMEZONE' | 'STANDARD' | 'DAYLIGHT'>;

/**
 * The name of an iCalendar property. I.E. DTSTART, SUMMARY, X-WR-CALNAME.
 *
 * https://datatracker.ietf.org/doc/html/rfc5545#section-3.7
 *
 * @semanticType
 * @semanticTopic string
 * @semanticTopic dereekb-date:icalendar
 */
export type ICalendarPropertyName = string;

/**
 * The name of an iCalendar property parameter. I.E. TZID, VALUE, CN.
 *
 * https://datatracker.ietf.org/doc/html/rfc5545#section-3.2
 *
 * @semanticType
 * @semanticTopic string
 * @semanticTopic dereekb-date:icalendar
 */
export type ICalendarParameterName = SuggestedString<'TZID' | 'VALUE' | 'CN' | 'ROLE' | 'PARTSTAT' | 'RSVP' | 'RELATED'>;

/**
 * An already-encoded iCalendar property parameter value.
 *
 * @semanticType
 * @semanticTopic string
 * @semanticTopic dereekb-date:icalendar
 */
export type ICalendarParameterValue = string;

/**
 * An already-encoded iCalendar property value. Escaping (where the value type calls for it) has already been applied.
 *
 * @semanticType
 * @semanticTopic string
 * @semanticTopic dereekb-date:icalendar
 */
export type ICalendarValue = string;

/**
 * An escaped iCalendar TEXT value.
 *
 * https://datatracker.ietf.org/doc/html/rfc5545#section-3.3.11
 *
 * @semanticType
 * @semanticTopic string
 * @semanticTopic dereekb-date:icalendar
 */
export type ICalendarTextValue = string;

/**
 * A complete iCalendar (RFC 5545) document, folded and CRLF-terminated.
 *
 * @semanticType
 * @semanticTopic string
 * @semanticTopic dereekb-date:icalendar
 */
export type ICalendarIcsString = string;

/**
 * A globally-unique, stable identifier for an event.
 *
 * https://datatracker.ietf.org/doc/html/rfc5545#section-3.8.4.7
 *
 * Stability across publishes is what lets a subscribing client correlate an update or a deletion with the
 * event it already has. A UID that changes between publishes produces a duplicate event instead of an update.
 *
 * @semanticType
 * @semanticTopic string
 * @semanticTopic dereekb-date:icalendar
 */
export type ICalendarUid = string;

/**
 * The PRODID of the product that generated the calendar.
 *
 * https://datatracker.ietf.org/doc/html/rfc5545#section-3.7.3
 *
 * @semanticType
 * @semanticTopic string
 * @semanticTopic dereekb-date:icalendar
 */
export type ICalendarProductId = string;

/**
 * A CAL-ADDRESS URI value. I.E. "mailto:person@example.com".
 *
 * https://datatracker.ietf.org/doc/html/rfc5545#section-3.3.3
 *
 * @semanticType
 * @semanticTopic string
 * @semanticTopic dereekb-date:icalendar
 */
export type ICalendarCalAddress = string;

/**
 * The iCalendar specification version this library emits.
 */
export const ICALENDAR_VERSION_2_0 = '2.0';

/**
 * The default PRODID emitted when the caller does not supply one.
 */
export const DEFAULT_ICALENDAR_PRODUCT_ID: ICalendarProductId = '-//dereekb//dbx-components//EN';

/**
 * The line ending required by RFC 5545 3.1. Every content line, including the last, is terminated with it.
 */
export const ICALENDAR_LINE_BREAK = '\r\n';

/**
 * Maximum octet length of a physical line in an ICS document, excluding the line break.
 *
 * https://datatracker.ietf.org/doc/html/rfc5545#section-3.1
 */
export const ICALENDAR_MAX_LINE_OCTETS = 75;

/**
 * The single space that prefixes a folded continuation line. It counts toward {@link ICALENDAR_MAX_LINE_OCTETS}.
 */
export const ICALENDAR_FOLD_PREFIX = ' ';

/**
 * Separates a property's name/parameter section from its value section.
 */
export const ICALENDAR_VALUE_SPLITTER = ':';

/**
 * Separates the property name from each of its parameters, and separates parameters from each other.
 */
export const ICALENDAR_PARAMETER_SPLITTER = ';';

/**
 * Separates the values within a multi-value property. I.E. CATEGORIES.
 */
export const ICALENDAR_VALUE_LIST_SEPARATOR = ',';

/**
 * The status of an event.
 *
 * https://datatracker.ietf.org/doc/html/rfc5545#section-3.8.1.11
 *
 * CANCELLED is how a published feed communicates a deletion to clients that have already seen the event.
 */
export type ICalendarEventStatus = SuggestedString<'TENTATIVE' | 'CONFIRMED' | 'CANCELLED'>;

/**
 * Whether an event consumes time on the owner's free/busy schedule.
 *
 * https://datatracker.ietf.org/doc/html/rfc5545#section-3.8.2.7
 */
export type ICalendarTransparency = SuggestedString<'OPAQUE' | 'TRANSPARENT'>;

/**
 * The access classification of an event.
 *
 * https://datatracker.ietf.org/doc/html/rfc5545#section-3.8.1.3
 */
export type ICalendarClassification = SuggestedString<'PUBLIC' | 'PRIVATE' | 'CONFIDENTIAL'>;

/**
 * The participation role of an attendee.
 *
 * https://datatracker.ietf.org/doc/html/rfc5545#section-3.2.16
 */
export type ICalendarAttendeeRole = SuggestedString<'CHAIR' | 'REQ-PARTICIPANT' | 'OPT-PARTICIPANT' | 'NON-PARTICIPANT'>;

/**
 * The participation status of an attendee.
 *
 * https://datatracker.ietf.org/doc/html/rfc5545#section-3.2.12
 */
export type ICalendarParticipationStatus = SuggestedString<'NEEDS-ACTION' | 'ACCEPTED' | 'DECLINED' | 'TENTATIVE' | 'DELEGATED'>;

/**
 * The action an alarm performs when it triggers.
 *
 * https://datatracker.ietf.org/doc/html/rfc5545#section-3.8.6.1
 */
export type ICalendarAlarmAction = SuggestedString<'DISPLAY' | 'AUDIO' | 'EMAIL'>;

/**
 * The iTIP method of the calendar payload.
 *
 * https://datatracker.ietf.org/doc/html/rfc5546
 *
 * Omitted by default: a METHOD turns the payload into an iTIP message, which some clients treat as an
 * invitation import rather than a subscription. It is right for an emailed .ics attachment, wrong for a feed.
 */
export type ICalendarMethod = SuggestedString<'PUBLISH' | 'REQUEST' | 'REPLY' | 'CANCEL' | 'ADD' | 'REFRESH' | 'COUNTER' | 'DECLINECOUNTER'>;
