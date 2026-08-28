import { describe, expect, it } from 'vitest';
import { unfoldIcsString } from '@dereekb/date';
import { unixDateTimeSecondsNumberFromDate } from '@dereekb/util';
import { type Calendar, type CalendarEventItem, type CalendarRecurringEventItem } from './calendar';
import { CalendarEventStatus } from './calendar.id';
import { calendarExtensionDataToICalendarExtraProperties, calendarToICalendar, calendarToIcsString } from './calendar.ics';

const NOW = new Date('2026-03-01T00:00:00.000Z');
const CALENDAR_ID = 'pr_abc123';
const ICS_CONFIG = { calendarId: CALENDAR_ID, domain: 'example.com', now: NOW };

function eventItem(id: string, startsAt: Date, overrides?: Partial<CalendarEventItem>): CalendarEventItem {
  return { id, sa: startsAt, dur: 60, n: `Event ${id}`, cat: NOW, uat: NOW, ...overrides };
}

function recurringEventItem(id: string, startsAt: Date, overrides?: Partial<CalendarRecurringEventItem>): CalendarRecurringEventItem {
  return { ...eventItem(id, startsAt), rr: 'RRULE:FREQ=WEEKLY;BYDAY=MO', ...overrides };
}

function calendarWith(input: Partial<Calendar>): Calendar {
  return { t: 'demo', n: 'Feed', tz: 'UTC', e: [], r: [], cat: NOW, uat: NOW, ...input };
}

describe('calendarExtensionDataToICalendarExtraProperties()', () => {
  it('should uppercase, strip illegal characters, and prefix with X-', () => {
    expect(calendarExtensionDataToICalendarExtraProperties({ my_key: 'v' })).toEqual([{ name: 'X-MYKEY', value: 'v' }]);
  });

  it('should not double-prefix a key that already starts with X-', () => {
    expect(calendarExtensionDataToICalendarExtraProperties({ 'x-thing': 'v' })).toEqual([{ name: 'X-THING', value: 'v' }]);
  });

  it('should keep a standard property name from being shadowed', () => {
    expect(calendarExtensionDataToICalendarExtraProperties({ summary: 'hijacked' })).toEqual([{ name: 'X-SUMMARY', value: 'hijacked' }]);
  });

  it('should drop a non-string value and a key that sanitizes to nothing', () => {
    expect(calendarExtensionDataToICalendarExtraProperties({ n: 1 as unknown as string, ___: 'v' })).toEqual([]);
  });

  it('should emit in sorted key order regardless of insertion order', () => {
    expect(calendarExtensionDataToICalendarExtraProperties({ zeta: 'z', alpha: 'a' }).map((x) => x.name)).toEqual(['X-ALPHA', 'X-ZETA']);
  });
});

describe('calendarToICalendar()', () => {
  it('should throw when neither a uidFactory nor a domain is supplied', () => {
    expect(() => calendarToICalendar(calendarWith({}), { calendarId: CALENDAR_ID })).toThrow();
  });

  it('should prefix every UID with the calendar id and suffix it with the domain', () => {
    const iCalendar = calendarToICalendar(calendarWith({ e: [eventItem('a', NOW)] }), ICS_CONFIG);

    expect(iCalendar.events[0].uid).toBe(`${CALENDAR_ID}-a@example.com`);
  });

  it('should carry the sequence and the status through to the event', () => {
    const iCalendar = calendarToICalendar(calendarWith({ e: [eventItem('a', NOW, { q: 3, st: CalendarEventStatus.CANCELLED })] }), ICS_CONFIG);

    expect(iCalendar.events[0].sequence).toBe(3);
    expect(iCalendar.events[0].status).toBe('CANCELLED');
  });

  it('should give a recurring event a DURATION and never an end', () => {
    const iCalendar = calendarToICalendar(calendarWith({ r: [recurringEventItem('a', NOW)] }), ICS_CONFIG);

    expect(iCalendar.events[0].duration).toBe(60);
    expect(iCalendar.events[0].end).not.toBeDefined();
  });

  it('should zone a recurring DTSTART when the event timezone is not UTC', () => {
    const iCalendar = calendarToICalendar(calendarWith({ tz: 'America/Denver', r: [recurringEventItem('a', NOW)] }), ICS_CONFIG);

    expect(iCalendar.events[0].start.type).toBe('zoned');
    expect(iCalendar.timezones?.map((x) => x.timezone)).toEqual(['America/Denver']);
  });

  it('should keep a UTC recurring DTSTART unzoned and derive no VTIMEZONE', () => {
    const iCalendar = calendarToICalendar(calendarWith({ r: [recurringEventItem('a', NOW)] }), ICS_CONFIG);

    expect(iCalendar.events[0].start.type).toBe('utc');
    expect(iCalendar.timezones).not.toBeDefined();
  });

  it('should emit one event per occurrence in expand mode, each carrying a recurrence id', () => {
    const range = { start: new Date('2026-03-01T00:00:00.000Z'), end: new Date('2026-03-31T00:00:00.000Z') };
    const iCalendar = calendarToICalendar(calendarWith({ r: [recurringEventItem('a', new Date('2026-03-02T16:00:00.000Z'))] }), { ...ICS_CONFIG, recurrenceMode: 'expand', expansionRange: range });

    expect(iCalendar.events.length).toBeGreaterThan(2);
    expect(iCalendar.events.every((x) => x.recurrenceId != null)).toBe(true);
    expect(iCalendar.events.every((x) => x.recurrence == null)).toBe(true);
  });
});

describe('calendarToIcsString()', () => {
  it('should emit exactly one RRULE line and never RRULE:RRULE:', () => {
    const ics = calendarToIcsString(calendarWith({ r: [recurringEventItem('a', NOW, { rr: 'RRULE:FREQ=WEEKLY;BYDAY=MO' })] }), ICS_CONFIG);
    const lines = unfoldIcsString(ics);

    expect(lines.filter((x) => x.startsWith('RRULE:'))).toEqual(['RRULE:FREQ=WEEKLY;BYDAY=MO']);
    expect(ics).not.toContain('RRULE:RRULE:');
  });

  it('should route an EXDATE line in the stored rule to EXDATE rather than RRULE', () => {
    const ics = calendarToIcsString(calendarWith({ r: [recurringEventItem('a', NOW, { rr: 'RRULE:FREQ=DAILY\nEXDATE:20260316T140000Z' })] }), ICS_CONFIG);
    const lines = unfoldIcsString(ics);

    expect(lines.filter((x) => x.startsWith('RRULE:'))).toEqual(['RRULE:FREQ=DAILY']);
    expect(lines).toContain('EXDATE:20260316T140000Z');
  });

  it('should merge rex exception dates into the emitted EXDATE lines', () => {
    const excluded = new Date('2026-03-09T16:00:00.000Z');
    const ics = calendarToIcsString(calendarWith({ r: [recurringEventItem('a', NOW, { rex: [unixDateTimeSecondsNumberFromDate(excluded)] })] }), ICS_CONFIG);

    expect(unfoldIcsString(ics)).toContain('EXDATE:20260309T160000Z');
  });

  it('should carry a TZID on a zoned recurring DTSTART and emit the matching VTIMEZONE', () => {
    const ics = calendarToIcsString(calendarWith({ tz: 'America/Denver', r: [recurringEventItem('a', NOW)] }), ICS_CONFIG);
    const lines = unfoldIcsString(ics);

    expect(lines.some((x) => x.startsWith('DTSTART;TZID=America/Denver:'))).toBe(true);
    expect(lines).toContain('BEGIN:VTIMEZONE');
    expect(lines).toContain('TZID:America/Denver');
  });

  it('should emit an exclusive all-day DTEND', () => {
    const ics = calendarToIcsString(calendarWith({ e: [eventItem('a', new Date('2026-03-15T00:00:00.000Z'), { ad: true, dur: 1440 })] }), ICS_CONFIG);
    const lines = unfoldIcsString(ics);

    expect(lines).toContain('DTSTART;VALUE=DATE:20260315');
    expect(lines).toContain('DTEND;VALUE=DATE:20260316');
  });

  it('should be byte-identical across two calls with the same input and a fixed now', () => {
    const calendar = calendarWith({ e: [eventItem('a', NOW)], r: [recurringEventItem('b', NOW)] });

    expect(calendarToIcsString(calendar, ICS_CONFIG)).toBe(calendarToIcsString(calendar, ICS_CONFIG));
  });

  it('should emit extension data on both the calendar and the event', () => {
    const ics = calendarToIcsString(calendarWith({ x: { calcolor: 'blue' }, e: [eventItem('a', NOW, { x: { thing: 'v' } })] }), ICS_CONFIG);
    const lines = unfoldIcsString(ics);

    expect(lines).toContain('X-CALCOLOR:blue');
    expect(lines).toContain('X-THING:v');
  });

  it('should keep the UID stable across regeneration after the event changed', () => {
    const first = calendarToIcsString(calendarWith({ e: [eventItem('a', NOW)] }), ICS_CONFIG);
    const second = calendarToIcsString(calendarWith({ e: [eventItem('a', NOW, { n: 'Renamed', q: 1 })] }), ICS_CONFIG);
    const uidOf = (ics: string) => unfoldIcsString(ics).find((x) => x.startsWith('UID:'));

    expect(uidOf(first)).toBe(uidOf(second));
    expect(first).not.toBe(second);
  });

  it('should emit REFRESH-INTERVAL and X-PUBLISHED-TTL when a refresh interval is set', () => {
    const lines = unfoldIcsString(calendarToIcsString(calendarWith({}), { ...ICS_CONFIG, refreshInterval: 60 }));

    expect(lines.some((x) => x.startsWith('REFRESH-INTERVAL;VALUE=DURATION:'))).toBe(true);
    expect(lines.some((x) => x.startsWith('X-PUBLISHED-TTL:'))).toBe(true);
  });
});
