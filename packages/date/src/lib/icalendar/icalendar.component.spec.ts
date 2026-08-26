import { wrapDateTests } from '../../test.spec';
import { DEFAULT_ICALENDAR_PRODUCT_ID, ICALENDAR_VERSION_2_0 } from './icalendar';
import { type ICalendarComponent, type ICalendarContentLine, DEFAULT_ICALENDAR_ALARM_DESCRIPTION, iCalendarAlarmToComponent, iCalendarAttendeeContentLine, iCalendarDateTimeContentLine, iCalendarEventToComponent, iCalendarExtraPropertyContentLine, iCalendarTimezoneToComponent, iCalendarToComponent } from './icalendar.component';
import { type ICalendar, type ICalendarEvent } from './icalendar.model';

const TEST_NOW = new Date('2026-03-01T00:00:00Z');

function lineNamed(component: ICalendarComponent, name: string): ICalendarContentLine | undefined {
  return component.lines.find((x) => x.name === name);
}

function linesNamed(component: ICalendarComponent, name: string): readonly ICalendarContentLine[] {
  return component.lines.filter((x) => x.name === name);
}

const TEST_EVENT: ICalendarEvent = {
  uid: 'a@example.com',
  start: { type: 'utc', at: new Date('2026-03-15T14:00:00Z') },
  end: { type: 'utc', at: new Date('2026-03-15T15:00:00Z') }
};

wrapDateTests(() => {
  describe('iCalendarDateTimeContentLine()', () => {
    it('should emit a UTC value with no parameters.', () => {
      const line = iCalendarDateTimeContentLine('DTSTART', { type: 'utc', at: new Date('2026-03-15T14:00:00Z') });

      expect(line.name).toBe('DTSTART');
      expect(line.value).toBe('20260315T140000Z');
      expect(line.parameters).toBeUndefined();
    });

    it('should emit a zoned value with a TZID parameter and no Z suffix.', () => {
      const line = iCalendarDateTimeContentLine('DTSTART', { type: 'zoned', at: new Date('2026-03-15T14:00:00Z'), timezone: 'America/Denver' });

      expect(line.value).toBe('20260315T080000');
      expect(line.parameters).toEqual([{ name: 'TZID', value: 'America/Denver' }]);
    });

    it('should emit an all-day value with a VALUE=DATE parameter.', () => {
      const line = iCalendarDateTimeContentLine('DTSTART', { type: 'date', day: '2026-03-15' });

      expect(line.value).toBe('20260315');
      expect(line.parameters).toEqual([{ name: 'VALUE', value: 'DATE' }]);
    });

    /**
     * date-fns throws a bare "RangeError: Invalid time value" from deep inside formatInTimeZone(), which
     * names neither the property nor the value. A published calendar that failed this way stayed stuck for
     * a day with a stack that could not say which date of which event was bad.
     */
    it('should name the property and the value for an invalid utc date.', () => {
      expect(() => iCalendarDateTimeContentLine('RDATE', { type: 'utc', at: new Date(NaN) })).toThrow(/RDATE/);
    });

    it('should name the property and the value for an invalid zoned date.', () => {
      expect(() => iCalendarDateTimeContentLine('EXDATE', { type: 'zoned', at: new Date(NaN), timezone: 'America/Denver' })).toThrow(/EXDATE/);
    });
  });

  describe('iCalendarExtraPropertyContentLine()', () => {
    it('should escape the value as TEXT.', () => {
      expect(iCalendarExtraPropertyContentLine({ name: 'X-THING', value: 'a,b' }).value).toBe(String.raw`a\,b`);
    });

    it('should throw for a property name carrying an illegal character.', () => {
      expect(() => iCalendarExtraPropertyContentLine({ name: 'X_THING', value: 'a' })).toThrow();
      expect(() => iCalendarExtraPropertyContentLine({ name: 'X THING', value: 'a' })).toThrow();
      expect(() => iCalendarExtraPropertyContentLine({ name: '', value: 'a' })).toThrow();
    });
  });

  describe('iCalendarAttendeeContentLine()', () => {
    it('should emit only the address when nothing else is set.', () => {
      const line = iCalendarAttendeeContentLine('ATTENDEE', { address: 'a@example.com' });

      expect(line.value).toBe('mailto:a@example.com');
      expect(line.parameters).toBeUndefined();
    });

    it('should emit every set parameter in canonical order.', () => {
      const line = iCalendarAttendeeContentLine('ATTENDEE', { address: 'a@example.com', name: 'A Person', role: 'REQ-PARTICIPANT', participationStatus: 'ACCEPTED', rsvp: true });

      expect(line.parameters).toEqual([
        { name: 'CN', value: 'A Person' },
        { name: 'ROLE', value: 'REQ-PARTICIPANT' },
        { name: 'PARTSTAT', value: 'ACCEPTED' },
        { name: 'RSVP', value: 'TRUE' }
      ]);
    });

    it('should quote a CN containing a comma.', () => {
      const line = iCalendarAttendeeContentLine('ATTENDEE', { address: 'a@example.com', name: 'Smith, John' });
      expect(line.parameters?.[0]).toEqual({ name: 'CN', value: '"Smith, John"' });
    });

    it('should emit RSVP:FALSE when rsvp is explicitly false.', () => {
      const line = iCalendarAttendeeContentLine('ATTENDEE', { address: 'a@example.com', rsvp: false });
      expect(line.parameters).toEqual([{ name: 'RSVP', value: 'FALSE' }]);
    });
  });

  describe('iCalendarAlarmToComponent()', () => {
    it('should emit a relative trigger as a duration with RELATED=START.', () => {
      const component = iCalendarAlarmToComponent({ action: 'DISPLAY', triggerMinutesRelativeToStart: -15 });
      const trigger = lineNamed(component, 'TRIGGER');

      expect(component.name).toBe('VALARM');
      expect(trigger?.value).toBe('-PT15M');
      expect(trigger?.parameters).toEqual([{ name: 'RELATED', value: 'START' }]);
    });

    it('should emit an absolute trigger as a UTC date-time.', () => {
      const component = iCalendarAlarmToComponent({ action: 'DISPLAY', triggerAt: new Date('2026-03-15T13:45:00Z') });
      const trigger = lineNamed(component, 'TRIGGER');

      expect(trigger?.value).toBe('20260315T134500Z');
      expect(trigger?.parameters).toEqual([{ name: 'VALUE', value: 'DATE-TIME' }]);
    });

    it('should prefer the relative trigger when both are set.', () => {
      const component = iCalendarAlarmToComponent({ action: 'DISPLAY', triggerMinutesRelativeToStart: -15, triggerAt: new Date('2026-03-15T13:45:00Z') });

      expect(component.lines.filter((x) => x.name === 'TRIGGER').length).toBe(1);
      expect(lineNamed(component, 'TRIGGER')?.value).toBe('-PT15M');
    });

    it('should default the RFC-required description.', () => {
      const component = iCalendarAlarmToComponent({ action: 'DISPLAY' });
      expect(lineNamed(component, 'DESCRIPTION')?.value).toBe(DEFAULT_ICALENDAR_ALARM_DESCRIPTION);
    });
  });

  describe('iCalendarTimezoneToComponent()', () => {
    it('should emit a TZID line and one sub-component per transition.', () => {
      const component = iCalendarTimezoneToComponent({
        timezone: 'America/Denver',
        transitions: [
          { daylight: false, startsAt: new Date('2026-01-01T00:00:00Z'), offsetFrom: -420, offsetTo: -420, name: 'MST' },
          { daylight: true, startsAt: new Date('2026-03-08T09:00:00Z'), offsetFrom: -420, offsetTo: -360, name: 'MDT' }
        ]
      });

      expect(component.name).toBe('VTIMEZONE');
      expect(lineNamed(component, 'TZID')?.value).toBe('America/Denver');
      expect(component.components?.length).toBe(2);
      expect(component.components?.[0].name).toBe('STANDARD');
      expect(component.components?.[1].name).toBe('DAYLIGHT');
      expect(lineNamed(component.components![1], 'TZOFFSETFROM')?.value).toBe('-0700');
      expect(lineNamed(component.components![1], 'TZOFFSETTO')?.value).toBe('-0600');
      expect(lineNamed(component.components![1], 'TZNAME')?.value).toBe('MDT');
      // the transition DTSTART is a floating local wall clock, with no TZID and no Z
      expect(lineNamed(component.components![1], 'DTSTART')?.value).toBe('20260308T090000');
      expect(lineNamed(component.components![1], 'DTSTART')?.parameters).toBeUndefined();
    });
  });

  describe('iCalendarEventToComponent()', () => {
    it('should emit UID, DTSTAMP and DTSTART first, in that order.', () => {
      const component = iCalendarEventToComponent(TEST_EVENT, TEST_NOW);

      expect(component.name).toBe('VEVENT');
      expect(component.lines.slice(0, 3).map((x) => x.name)).toEqual(['UID', 'DTSTAMP', 'DTSTART']);
      expect(lineNamed(component, 'DTSTAMP')?.value).toBe('20260301T000000Z');
    });

    it('should prefer the per-event timestamp over the calendar default.', () => {
      const component = iCalendarEventToComponent({ ...TEST_EVENT, timestamp: new Date('2026-02-01T00:00:00Z') }, TEST_NOW);
      expect(lineNamed(component, 'DTSTAMP')?.value).toBe('20260201T000000Z');
    });

    it('should throw when the uid is missing.', () => {
      expect(() => iCalendarEventToComponent({ ...TEST_EVENT, uid: undefined as unknown as string }, TEST_NOW)).toThrow();
    });

    it('should throw when the uid is empty.', () => {
      expect(() => iCalendarEventToComponent({ ...TEST_EVENT, uid: '   ' }, TEST_NOW)).toThrow();
    });

    it('should throw when the start is missing.', () => {
      expect(() => iCalendarEventToComponent({ uid: 'a@example.com' } as ICalendarEvent, TEST_NOW)).toThrow();
    });

    it('should emit DTEND and not DURATION when both are set.', () => {
      const component = iCalendarEventToComponent({ ...TEST_EVENT, duration: 60 }, TEST_NOW);

      expect(lineNamed(component, 'DTEND')?.value).toBe('20260315T150000Z');
      expect(lineNamed(component, 'DURATION')).toBeUndefined();
    });

    it('should emit DURATION when there is no end.', () => {
      const component = iCalendarEventToComponent({ uid: TEST_EVENT.uid, start: TEST_EVENT.start, duration: 90 }, TEST_NOW);

      expect(lineNamed(component, 'DTEND')).toBeUndefined();
      expect(lineNamed(component, 'DURATION')?.value).toBe('PT1H30M');
    });

    it('should emit neither DTEND nor DURATION when neither is set.', () => {
      const component = iCalendarEventToComponent({ uid: TEST_EVENT.uid, start: TEST_EVENT.start }, TEST_NOW);

      expect(lineNamed(component, 'DTEND')).toBeUndefined();
      expect(lineNamed(component, 'DURATION')).toBeUndefined();
    });

    it('should escape the text properties.', () => {
      const component = iCalendarEventToComponent({ ...TEST_EVENT, summary: 'a,b', description: 'line1\nline2', location: 'a;b' }, TEST_NOW);

      expect(lineNamed(component, 'SUMMARY')?.value).toBe(String.raw`a\,b`);
      expect(lineNamed(component, 'DESCRIPTION')?.value).toBe(String.raw`line1\nline2`);
      expect(lineNamed(component, 'LOCATION')?.value).toBe(String.raw`a\;b`);
    });

    it('should omit SEQUENCE when it is zero or unset.', () => {
      expect(lineNamed(iCalendarEventToComponent(TEST_EVENT, TEST_NOW), 'SEQUENCE')).toBeUndefined();
      expect(lineNamed(iCalendarEventToComponent({ ...TEST_EVENT, sequence: 0 }, TEST_NOW), 'SEQUENCE')).toBeUndefined();
    });

    it('should emit SEQUENCE when it is non-zero.', () => {
      expect(lineNamed(iCalendarEventToComponent({ ...TEST_EVENT, sequence: 3 }, TEST_NOW), 'SEQUENCE')?.value).toBe('3');
    });

    it('should emit STATUS:CANCELLED.', () => {
      expect(lineNamed(iCalendarEventToComponent({ ...TEST_EVENT, status: 'CANCELLED' }, TEST_NOW), 'STATUS')?.value).toBe('CANCELLED');
    });

    it('should emit CATEGORIES with each element escaped individually.', () => {
      expect(lineNamed(iCalendarEventToComponent({ ...TEST_EVENT, categories: ['a,b', 'c'] }, TEST_NOW), 'CATEGORIES')?.value).toBe(String.raw`a\,b,c`);
    });

    it('should emit GEO with an unescaped semicolon separator.', () => {
      expect(lineNamed(iCalendarEventToComponent({ ...TEST_EVENT, geo: { lat: 39.7392, lng: -104.9903 } }, TEST_NOW), 'GEO')?.value).toBe('39.7392;-104.9903');
    });

    it('should emit the recurrence pass-through properties.', () => {
      const component = iCalendarEventToComponent(
        {
          ...TEST_EVENT,
          recurrence: {
            rules: ['FREQ=WEEKLY;BYDAY=MO,WE'],
            additionalDates: [{ type: 'utc', at: new Date('2026-03-22T14:00:00Z') }],
            exceptionDates: [{ type: 'utc', at: new Date('2026-03-29T14:00:00Z') }]
          }
        },
        TEST_NOW
      );

      expect(lineNamed(component, 'RRULE')?.value).toBe('FREQ=WEEKLY;BYDAY=MO,WE');
      expect(lineNamed(component, 'RDATE')?.value).toBe('20260322T140000Z');
      expect(lineNamed(component, 'EXDATE')?.value).toBe('20260329T140000Z');
    });

    it('should emit one ATTENDEE line per attendee.', () => {
      const component = iCalendarEventToComponent({ ...TEST_EVENT, organizer: { address: 'o@example.com' }, attendees: [{ address: 'a@example.com' }, { address: 'b@example.com' }] }, TEST_NOW);

      expect(lineNamed(component, 'ORGANIZER')?.value).toBe('mailto:o@example.com');
      expect(linesNamed(component, 'ATTENDEE').map((x) => x.value)).toEqual(['mailto:a@example.com', 'mailto:b@example.com']);
    });

    it('should nest a VALARM sub-component per alarm.', () => {
      const component = iCalendarEventToComponent({ ...TEST_EVENT, alarms: [{ action: 'DISPLAY', triggerMinutesRelativeToStart: -15 }] }, TEST_NOW);

      expect(component.components?.length).toBe(1);
      expect(component.components?.[0].name).toBe('VALARM');
    });

    it('should emit event extra properties after every standard property.', () => {
      const component = iCalendarEventToComponent({ ...TEST_EVENT, summary: 'S', attendees: [{ address: 'a@example.com' }], extraProperties: [{ name: 'X-THING', value: 'v' }] }, TEST_NOW);
      const names = component.lines.map((x) => x.name);

      expect(lineNamed(component, 'X-THING')?.value).toBe('v');
      expect(names.indexOf('X-THING')).toBeGreaterThan(names.indexOf('ATTENDEE'));
      expect(names[names.length - 1]).toBe('X-THING');
    });

    it('should leave the standard event property order unchanged when extras are present.', () => {
      const without = iCalendarEventToComponent({ ...TEST_EVENT, summary: 'S' }, TEST_NOW);
      const withExtras = iCalendarEventToComponent({ ...TEST_EVENT, summary: 'S', extraProperties: [{ name: 'X-THING', value: 'v' }] }, TEST_NOW);

      expect(withExtras.lines.slice(0, without.lines.length)).toEqual(without.lines);
    });

    it('should throw when an event extra property name is invalid.', () => {
      expect(() => iCalendarEventToComponent({ ...TEST_EVENT, extraProperties: [{ name: 'X.THING', value: 'v' }] }, TEST_NOW)).toThrow();
    });
  });

  describe('iCalendarToComponent()', () => {
    const calendar: ICalendar = { events: [TEST_EVENT] };

    it('should emit PRODID, VERSION and CALSCALE first, in that order.', () => {
      const component = iCalendarToComponent(calendar, { now: TEST_NOW });

      expect(component.name).toBe('VCALENDAR');
      expect(component.lines.slice(0, 3).map((x) => x.name)).toEqual(['PRODID', 'VERSION', 'CALSCALE']);
      expect(lineNamed(component, 'PRODID')?.value).toBe(DEFAULT_ICALENDAR_PRODUCT_ID.replaceAll(',', String.raw`\,`));
      expect(lineNamed(component, 'VERSION')?.value).toBe(ICALENDAR_VERSION_2_0);
    });

    it('should prefer the config productId over the calendar productId.', () => {
      const component = iCalendarToComponent({ ...calendar, productId: 'model' }, { now: TEST_NOW, productId: 'config' });
      expect(lineNamed(component, 'PRODID')?.value).toBe('config');
    });

    it('should omit METHOD by default.', () => {
      expect(lineNamed(iCalendarToComponent(calendar, { now: TEST_NOW }), 'METHOD')).toBeUndefined();
    });

    it('should emit METHOD when explicitly requested.', () => {
      expect(lineNamed(iCalendarToComponent({ ...calendar, method: 'PUBLISH' }, { now: TEST_NOW }), 'METHOD')?.value).toBe('PUBLISH');
    });

    it('should emit both the RFC 7986 and X-WR- names.', () => {
      const component = iCalendarToComponent({ ...calendar, name: 'My Feed', description: 'A feed' }, { now: TEST_NOW });

      expect(lineNamed(component, 'NAME')?.value).toBe('My Feed');
      expect(lineNamed(component, 'X-WR-CALNAME')?.value).toBe('My Feed');
      expect(lineNamed(component, 'DESCRIPTION')?.value).toBe('A feed');
      expect(lineNamed(component, 'X-WR-CALDESC')?.value).toBe('A feed');
    });

    it('should emit both REFRESH-INTERVAL and X-PUBLISHED-TTL.', () => {
      const component = iCalendarToComponent({ ...calendar, refreshInterval: 720 }, { now: TEST_NOW });

      expect(lineNamed(component, 'REFRESH-INTERVAL')?.value).toBe('PT12H');
      expect(lineNamed(component, 'REFRESH-INTERVAL')?.parameters).toEqual([{ name: 'VALUE', value: 'DURATION' }]);
      expect(lineNamed(component, 'X-PUBLISHED-TTL')?.value).toBe('PT12H');
    });

    it('should emit SOURCE with a VALUE=URI parameter.', () => {
      const component = iCalendarToComponent({ ...calendar, source: 'https://example.com/feed.ics' }, { now: TEST_NOW });

      expect(lineNamed(component, 'SOURCE')?.value).toBe('https://example.com/feed.ics');
      expect(lineNamed(component, 'SOURCE')?.parameters).toEqual([{ name: 'VALUE', value: 'URI' }]);
    });

    it('should emit X-WR-TIMEZONE.', () => {
      expect(lineNamed(iCalendarToComponent({ ...calendar, timezone: 'America/Denver' }, { now: TEST_NOW }), 'X-WR-TIMEZONE')?.value).toBe('America/Denver');
    });

    it('should place VTIMEZONE components before VEVENT components.', () => {
      const component = iCalendarToComponent(
        {
          ...calendar,
          timezones: [{ timezone: 'America/Denver', transitions: [{ daylight: false, startsAt: new Date('2026-01-01T00:00:00Z'), offsetFrom: -420, offsetTo: -420 }] }]
        },
        { now: TEST_NOW }
      );

      expect(component.components?.map((x) => x.name)).toEqual(['VTIMEZONE', 'VEVENT']);
    });

    it('should be byte-stable across repeated conversions.', () => {
      const a = iCalendarToComponent(calendar, { now: TEST_NOW });
      const b = iCalendarToComponent(calendar, { now: TEST_NOW });

      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });

    it('should be insensitive to the order the model keys were declared in.', () => {
      const a = iCalendarToComponent({ name: 'Feed', description: 'D', events: [{ uid: 'a@example.com', summary: 'S', start: TEST_EVENT.start, end: TEST_EVENT.end }] }, { now: TEST_NOW });
      const b = iCalendarToComponent({ events: [{ end: TEST_EVENT.end, start: TEST_EVENT.start, summary: 'S', uid: 'a@example.com' }], description: 'D', name: 'Feed' }, { now: TEST_NOW });

      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });

    it('should emit calendar extra properties after the standard properties.', () => {
      const component = iCalendarToComponent({ ...calendar, timezone: 'America/Denver', extraProperties: [{ name: 'X-WR-CALCOLOR', value: 'blue' }] }, { now: TEST_NOW });
      const names = component.lines.map((x) => x.name);

      expect(lineNamed(component, 'X-WR-CALCOLOR')?.value).toBe('blue');
      expect(names.indexOf('X-WR-CALCOLOR')).toBeGreaterThan(names.indexOf('X-WR-TIMEZONE'));
      expect(names[names.length - 1]).toBe('X-WR-CALCOLOR');
    });

    it('should emit calendar extra properties in the order they were given.', () => {
      const component = iCalendarToComponent(
        {
          ...calendar,
          extraProperties: [
            { name: 'X-B', value: 'b' },
            { name: 'X-A', value: 'a' }
          ]
        },
        { now: TEST_NOW }
      );

      expect(component.lines.filter((x) => x.name.startsWith('X-')).map((x) => x.name)).toEqual(['X-B', 'X-A']);
    });

    it('should leave the standard property order unchanged when extras are present.', () => {
      const without = iCalendarToComponent({ ...calendar, timezone: 'America/Denver' }, { now: TEST_NOW });
      const withExtras = iCalendarToComponent({ ...calendar, timezone: 'America/Denver', extraProperties: [{ name: 'X-THING', value: 'v' }] }, { now: TEST_NOW });

      expect(withExtras.lines.slice(0, without.lines.length)).toEqual(without.lines);
    });

    it('should throw when a calendar extra property name is invalid.', () => {
      expect(() => iCalendarToComponent({ ...calendar, extraProperties: [{ name: 'X THING', value: 'v' }] }, { now: TEST_NOW })).toThrow();
    });
  });
});
