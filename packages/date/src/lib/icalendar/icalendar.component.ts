import { type Maybe } from '@dereekb/util';
import { type ICalendarComponentName, type ICalendarParameterName, type ICalendarParameterValue, type ICalendarPropertyName, type ICalendarValue, DEFAULT_ICALENDAR_PRODUCT_ID, ICALENDAR_VERSION_2_0 } from './icalendar';
import { type ICalendar, type ICalendarAlarm, type ICalendarAttendee, type ICalendarDateTimeValue, type ICalendarEvent, type ICalendarOrganizer, type ICalendarSerializeConfig, type ICalendarTimezone, type ICalendarTimezoneTransition } from './icalendar.model';
import { hasICalendarValue, iCalendarBooleanValue, iCalendarCalAddressValue, iCalendarDateString, iCalendarDurationString, iCalendarFloatingDateTimeString, iCalendarGeoValue, iCalendarIntegerValue, iCalendarParameterValue, iCalendarTextListValue, iCalendarTextValue, iCalendarUtcDateTimeString, iCalendarUtcOffsetString, iCalendarZonedDateTimeString } from './icalendar.value';

/**
 * A single already-encoded parameter on a content line.
 */
export interface ICalendarContentLineParameter {
  readonly name: ICalendarParameterName;
  /**
   * The already-encoded parameter value. See iCalendarParameterValue().
   */
  readonly value: ICalendarParameterValue;
}

/**
 * A single already-encoded property of a component, independent of the serialization format.
 *
 * This is the unit both an ICS emitter and any future jCal/xCal emitter consume: the value has been encoded
 * for its value type, but nothing about line assembly, folding or line endings has happened yet.
 */
export interface ICalendarContentLine {
  readonly name: ICalendarPropertyName;
  readonly parameters?: Maybe<readonly ICalendarContentLineParameter[]>;
  /**
   * The already-encoded value.
   */
  readonly value: ICalendarValue;
}

/**
 * A component in the intermediate tree. I.E. a VCALENDAR containing VEVENTs, each containing VALARMs.
 *
 * The tree is the serialization seam: {@link iCalendarToComponent} builds it from the domain model without
 * any knowledge of ICS, and a format emitter turns it into a string without any knowledge of the domain model.
 */
export interface ICalendarComponent {
  readonly name: ICalendarComponentName;
  readonly lines: readonly ICalendarContentLine[];
  readonly components?: Maybe<readonly ICalendarComponent[]>;
}

/**
 * Builds a content line.
 *
 * @param name - The property name.
 * @param value - The already-encoded property value.
 * @param parameters - Optional already-encoded parameters.
 * @returns The content line.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function iCalendarContentLine(name: ICalendarPropertyName, value: ICalendarValue, parameters?: Maybe<readonly ICalendarContentLineParameter[]>): ICalendarContentLine {
  return parameters?.length ? { name, value, parameters } : { name, value };
}

/**
 * Encodes a date-time value as the value plus parameters of a content line.
 *
 * @param name - The property name. I.E. DTSTART.
 * @param value - The date-time to encode.
 * @returns The content line.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function iCalendarDateTimeContentLine(name: ICalendarPropertyName, value: ICalendarDateTimeValue): ICalendarContentLine {
  let result: ICalendarContentLine;

  switch (value.type) {
    case 'utc':
      result = iCalendarContentLine(name, iCalendarUtcDateTimeString(value.at));
      break;
    case 'zoned':
      result = iCalendarContentLine(name, iCalendarZonedDateTimeString(value.at, value.timezone), [{ name: 'TZID', value: iCalendarParameterValue(value.timezone) }]);
      break;
    case 'date':
      result = iCalendarContentLine(name, iCalendarDateString(value.day), [{ name: 'VALUE', value: 'DATE' }]);
      break;
  }

  return result;
}

/**
 * Converts an attendee or organizer into a content line.
 *
 * @param name - The property name. I.E. ATTENDEE or ORGANIZER.
 * @param attendee - The participant to encode.
 * @returns The content line.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function iCalendarAttendeeContentLine(name: ICalendarPropertyName, attendee: ICalendarAttendee | ICalendarOrganizer): ICalendarContentLine {
  const full = attendee as ICalendarAttendee;
  const parameters: ICalendarContentLineParameter[] = [];

  if (hasICalendarValue(attendee.name)) {
    parameters.push({ name: 'CN', value: iCalendarParameterValue(attendee.name) });
  }

  if (hasICalendarValue(full.role)) {
    parameters.push({ name: 'ROLE', value: iCalendarParameterValue(full.role) });
  }

  if (hasICalendarValue(full.participationStatus)) {
    parameters.push({ name: 'PARTSTAT', value: iCalendarParameterValue(full.participationStatus) });
  }

  if (full.rsvp != null) {
    parameters.push({ name: 'RSVP', value: iCalendarBooleanValue(full.rsvp) });
  }

  return iCalendarContentLine(name, iCalendarCalAddressValue(attendee.address), parameters);
}

/**
 * The description RFC 5545 requires on a DISPLAY or EMAIL alarm that carries none of its own.
 */
export const DEFAULT_ICALENDAR_ALARM_DESCRIPTION = 'Reminder';

/**
 * Converts an alarm into a VALARM component.
 *
 * @param alarm - The alarm to convert.
 * @returns The VALARM component.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function iCalendarAlarmToComponent(alarm: ICalendarAlarm): ICalendarComponent {
  const lines: ICalendarContentLine[] = [iCalendarContentLine('ACTION', alarm.action)];

  if (alarm.triggerMinutesRelativeToStart != null) {
    lines.push(iCalendarContentLine('TRIGGER', iCalendarDurationString(alarm.triggerMinutesRelativeToStart), [{ name: 'RELATED', value: 'START' }]));
  } else if (alarm.triggerAt != null) {
    lines.push(iCalendarContentLine('TRIGGER', iCalendarUtcDateTimeString(alarm.triggerAt), [{ name: 'VALUE', value: 'DATE-TIME' }]));
  }

  lines.push(iCalendarContentLine('DESCRIPTION', iCalendarTextValue(hasICalendarValue(alarm.description) ? alarm.description : DEFAULT_ICALENDAR_ALARM_DESCRIPTION)));

  if (hasICalendarValue(alarm.summary)) {
    lines.push(iCalendarContentLine('SUMMARY', iCalendarTextValue(alarm.summary)));
  }

  return { name: 'VALARM', lines };
}

/**
 * Converts a timezone transition into a STANDARD or DAYLIGHT component.
 *
 * @param transition - The transition to convert.
 * @returns The sub-component.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function iCalendarTimezoneTransitionToComponent(transition: ICalendarTimezoneTransition): ICalendarComponent {
  const lines: ICalendarContentLine[] = [
    // within a VTIMEZONE, DTSTART is defined to be the transition's local wall clock, so it carries no TZID and no Z
    iCalendarContentLine('DTSTART', iCalendarFloatingDateTimeString(transition.startsAt)),
    iCalendarContentLine('TZOFFSETFROM', iCalendarUtcOffsetString(transition.offsetFrom)),
    iCalendarContentLine('TZOFFSETTO', iCalendarUtcOffsetString(transition.offsetTo))
  ];

  if (hasICalendarValue(transition.name)) {
    lines.push(iCalendarContentLine('TZNAME', iCalendarTextValue(transition.name)));
  }

  return { name: transition.daylight ? 'DAYLIGHT' : 'STANDARD', lines };
}

/**
 * Converts a timezone into a VTIMEZONE component.
 *
 * @param timezone - The timezone to convert.
 * @returns The VTIMEZONE component.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function iCalendarTimezoneToComponent(timezone: ICalendarTimezone): ICalendarComponent {
  return {
    name: 'VTIMEZONE',
    lines: [iCalendarContentLine('TZID', timezone.timezone)],
    components: timezone.transitions.map(iCalendarTimezoneTransitionToComponent)
  };
}

/**
 * Converts an event into a VEVENT component.
 *
 * Properties are emitted in a fixed canonical order so identical input yields byte-identical output.
 *
 * @param event - The event to convert.
 * @param timestamp - The DTSTAMP to use when the event carries none of its own.
 * @returns The VEVENT component.
 * @throws {Error} If the event has no UID, which clients silently drop.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function iCalendarEventToComponent(event: ICalendarEvent, timestamp: Date): ICalendarComponent {
  if (!hasICalendarValue(event.uid)) {
    throw new Error('An ICalendarEvent requires a non-empty uid. A UID-less VEVENT is silently dropped by calendar clients.');
  }

  if (event.start == null) {
    throw new Error(`The ICalendarEvent "${event.uid}" requires a start value.`);
  }

  const lines: ICalendarContentLine[] = [iCalendarContentLine('UID', iCalendarTextValue(event.uid)), iCalendarContentLine('DTSTAMP', iCalendarUtcDateTimeString(event.timestamp ?? timestamp)), iCalendarDateTimeContentLine('DTSTART', event.start)];

  // RFC 5545 3.6.1: a VEVENT must not carry both DTEND and DURATION. DTEND wins.
  if (event.end != null) {
    lines.push(iCalendarDateTimeContentLine('DTEND', event.end));
  } else if (event.duration != null) {
    lines.push(iCalendarContentLine('DURATION', iCalendarDurationString(event.duration)));
  }

  if (hasICalendarValue(event.summary)) {
    lines.push(iCalendarContentLine('SUMMARY', iCalendarTextValue(event.summary)));
  }

  if (hasICalendarValue(event.description)) {
    lines.push(iCalendarContentLine('DESCRIPTION', iCalendarTextValue(event.description)));
  }

  if (hasICalendarValue(event.location)) {
    lines.push(iCalendarContentLine('LOCATION', iCalendarTextValue(event.location)));
  }

  if (event.geo != null) {
    lines.push(iCalendarContentLine('GEO', iCalendarGeoValue(event.geo)));
  }

  if (hasICalendarValue(event.url)) {
    lines.push(iCalendarContentLine('URL', event.url));
  }

  if (hasICalendarValue(event.status)) {
    lines.push(iCalendarContentLine('STATUS', event.status));
  }

  if (hasICalendarValue(event.transparency)) {
    lines.push(iCalendarContentLine('TRANSP', event.transparency));
  }

  if (hasICalendarValue(event.classification)) {
    lines.push(iCalendarContentLine('CLASS', event.classification));
  }

  if (event.categories?.length) {
    lines.push(iCalendarContentLine('CATEGORIES', iCalendarTextListValue(event.categories)));
  }

  if (event.priority != null) {
    lines.push(iCalendarContentLine('PRIORITY', iCalendarIntegerValue(event.priority)));
  }

  // a bare SEQUENCE:0 is the implied default, so it is only emitted when it carries information
  if (event.sequence) {
    lines.push(iCalendarContentLine('SEQUENCE', iCalendarIntegerValue(event.sequence)));
  }

  if (event.created != null) {
    lines.push(iCalendarContentLine('CREATED', iCalendarUtcDateTimeString(event.created)));
  }

  if (event.lastModified != null) {
    lines.push(iCalendarContentLine('LAST-MODIFIED', iCalendarUtcDateTimeString(event.lastModified)));
  }

  if (event.recurrenceId != null) {
    lines.push(iCalendarDateTimeContentLine('RECURRENCE-ID', event.recurrenceId));
  }

  if (event.recurrence != null) {
    const { rules, additionalDates, exceptionDates } = event.recurrence;

    rules?.forEach((rule) => lines.push(iCalendarContentLine('RRULE', rule)));
    additionalDates?.forEach((date) => lines.push(iCalendarDateTimeContentLine('RDATE', date)));
    exceptionDates?.forEach((date) => lines.push(iCalendarDateTimeContentLine('EXDATE', date)));
  }

  if (event.organizer != null) {
    lines.push(iCalendarAttendeeContentLine('ORGANIZER', event.organizer));
  }

  event.attendees?.forEach((attendee) => lines.push(iCalendarAttendeeContentLine('ATTENDEE', attendee)));

  const components = event.alarms?.length ? event.alarms.map(iCalendarAlarmToComponent) : undefined;

  return components ? { name: 'VEVENT', lines, components } : { name: 'VEVENT', lines };
}

/**
 * Converts a calendar into its component tree.
 *
 * THE SERIALIZATION SEAM. This function is format-agnostic: it knows the RFC 5545 data model (component
 * names, property names, value encodings) but nothing about how those are written out. An ICS emitter, and
 * any future jCal (RFC 7265) or xCal (RFC 6321) emitter, all consume this same tree.
 *
 * Properties are emitted in a fixed canonical order and no object keys are iterated, so identical input
 * yields byte-identical output. That lets a publisher content-hash the payload and skip a no-op write.
 *
 * @param calendar - The calendar to convert.
 * @param config - Optional serialization config, notably the DTSTAMP source.
 * @returns The VCALENDAR component.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function iCalendarToComponent(calendar: ICalendar, config?: Maybe<ICalendarSerializeConfig>): ICalendarComponent {
  const timestamp = config?.now ?? new Date();
  const productId = config?.productId ?? calendar.productId ?? DEFAULT_ICALENDAR_PRODUCT_ID;

  const lines: ICalendarContentLine[] = [iCalendarContentLine('PRODID', iCalendarTextValue(productId)), iCalendarContentLine('VERSION', ICALENDAR_VERSION_2_0), iCalendarContentLine('CALSCALE', 'GREGORIAN')];

  if (hasICalendarValue(calendar.method)) {
    lines.push(iCalendarContentLine('METHOD', calendar.method));
  }

  // RFC 7986 properties are the future-proof names; the X-WR-* twins are what actually set the display
  // name/description of a subscribed calendar in current Google and Apple clients. Both are emitted.
  if (hasICalendarValue(calendar.name)) {
    const name = iCalendarTextValue(calendar.name);
    lines.push(iCalendarContentLine('NAME', name), iCalendarContentLine('X-WR-CALNAME', name));
  }

  if (hasICalendarValue(calendar.description)) {
    const description = iCalendarTextValue(calendar.description);
    lines.push(iCalendarContentLine('DESCRIPTION', description), iCalendarContentLine('X-WR-CALDESC', description));
  }

  if (hasICalendarValue(calendar.color)) {
    lines.push(iCalendarContentLine('COLOR', calendar.color));
  }

  if (calendar.refreshInterval != null) {
    const refreshInterval = iCalendarDurationString(calendar.refreshInterval);
    lines.push(iCalendarContentLine('REFRESH-INTERVAL', refreshInterval, [{ name: 'VALUE', value: 'DURATION' }]), iCalendarContentLine('X-PUBLISHED-TTL', refreshInterval));
  }

  if (hasICalendarValue(calendar.source)) {
    lines.push(iCalendarContentLine('SOURCE', calendar.source, [{ name: 'VALUE', value: 'URI' }]));
  }

  if (hasICalendarValue(calendar.url)) {
    lines.push(iCalendarContentLine('URL', calendar.url));
  }

  if (hasICalendarValue(calendar.timezone)) {
    lines.push(iCalendarContentLine('X-WR-TIMEZONE', calendar.timezone));
  }

  const timezoneComponents = (calendar.timezones ?? []).map(iCalendarTimezoneToComponent);
  const eventComponents = calendar.events.map((event) => iCalendarEventToComponent(event, timestamp));

  return { name: 'VCALENDAR', lines, components: [...timezoneComponents, ...eventComponents] };
}
