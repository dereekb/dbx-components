import { wrapDateTests } from '../../test.spec';
import { DateRRuleParseUtility } from '../rrule/date.rrule.parse';
import { targetDateToBaseDate } from '../date/date.timezone';
import { ICALENDAR_LINE_BREAK } from './icalendar';
import { iCalendarEventForCalendarDate, iCalendarUidFactory } from './icalendar.factory';
import { iCalendarToIcsString, unfoldIcsString } from './icalendar.ics';
import { type ICalendar } from './icalendar.model';
import { calendarDate } from '../date/date.calendar';
import { iCalendarWithDerivedTimezones } from './icalendar.vtimezone';

const TEST_NOW = new Date('2026-03-01T00:00:00Z');
const TEST_CONFIG = { now: TEST_NOW };

/**
 * Joins the given logical lines into the exact CRLF-terminated document the serializer should produce.
 */
function icsDocument(lines: readonly string[]): string {
  return `${lines.join(ICALENDAR_LINE_BREAK)}${ICALENDAR_LINE_BREAK}`;
}

wrapDateTests(() => {
  describe('iCalendarToIcsString()', () => {
    describe('a minimal single-event calendar', () => {
      const calendar: ICalendar = {
        events: [
          {
            uid: 'event-1@example.com',
            start: { type: 'utc', at: new Date('2026-03-15T14:00:00Z') },
            end: { type: 'utc', at: new Date('2026-03-15T15:00:00Z') },
            summary: 'Standup'
          }
        ]
      };

      it('should produce the expected document.', () => {
        expect(iCalendarToIcsString(calendar, TEST_CONFIG)).toBe(
          icsDocument(['BEGIN:VCALENDAR', 'PRODID:-//dereekb//dbx-components//EN', 'VERSION:2.0', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', 'UID:event-1@example.com', 'DTSTAMP:20260301T000000Z', 'DTSTART:20260315T140000Z', 'DTEND:20260315T150000Z', 'SUMMARY:Standup', 'END:VEVENT', 'END:VCALENDAR'])
        );
      });
    });

    describe('a feed with metadata', () => {
      const calendar: ICalendar = {
        name: 'Team Feed',
        description: 'Everything the team is doing',
        color: 'cornflowerblue',
        refreshInterval: 720,
        source: 'https://example.com/feed.ics',
        url: 'https://example.com',
        timezone: 'America/Denver',
        events: []
      };

      it('should produce the expected document.', () => {
        expect(iCalendarToIcsString(calendar, TEST_CONFIG)).toBe(
          icsDocument([
            'BEGIN:VCALENDAR',
            'PRODID:-//dereekb//dbx-components//EN',
            'VERSION:2.0',
            'CALSCALE:GREGORIAN',
            'NAME:Team Feed',
            'X-WR-CALNAME:Team Feed',
            'DESCRIPTION:Everything the team is doing',
            'X-WR-CALDESC:Everything the team is doing',
            'COLOR:cornflowerblue',
            'REFRESH-INTERVAL;VALUE=DURATION:PT12H',
            'X-PUBLISHED-TTL:PT12H',
            'SOURCE;VALUE=URI:https://example.com/feed.ics',
            'URL:https://example.com',
            'X-WR-TIMEZONE:America/Denver',
            'END:VCALENDAR'
          ])
        );
      });
    });

    describe('an all-day event', () => {
      it('should produce an exclusive DTEND regardless of the system timezone.', () => {
        const uid = iCalendarUidFactory({ domain: 'example.com', prefix: 'day' });
        const event = iCalendarEventForCalendarDate(calendarDate('2026-03-15', 1, 'America/Denver'), { uid: uid('a'), summary: 'Holiday', timezone: 'America/Denver' });

        expect(iCalendarToIcsString({ events: [event] }, TEST_CONFIG)).toBe(
          icsDocument(['BEGIN:VCALENDAR', 'PRODID:-//dereekb//dbx-components//EN', 'VERSION:2.0', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', 'UID:day-a@example.com', 'DTSTAMP:20260301T000000Z', 'DTSTART;VALUE=DATE:20260315', 'DTEND;VALUE=DATE:20260316', 'SUMMARY:Holiday', 'END:VEVENT', 'END:VCALENDAR'])
        );
      });

      it('should produce an exclusive DTEND for a multi-day event.', () => {
        const event = iCalendarEventForCalendarDate(calendarDate('2026-03-15', 3, false), { uid: 'a@example.com', timezone: false });
        const lines = unfoldIcsString(iCalendarToIcsString({ events: [event] }, TEST_CONFIG));

        expect(lines).toContain('DTSTART;VALUE=DATE:20260315');
        expect(lines).toContain('DTEND;VALUE=DATE:20260318');
      });
    });

    describe('a cancelled event', () => {
      it('should carry STATUS:CANCELLED and a bumped SEQUENCE.', () => {
        const calendar: ICalendar = {
          events: [
            {
              uid: 'event-1@example.com',
              start: { type: 'utc', at: new Date('2026-03-15T14:00:00Z') },
              end: { type: 'utc', at: new Date('2026-03-15T15:00:00Z') },
              summary: 'Standup',
              status: 'CANCELLED',
              sequence: 2
            }
          ]
        };

        expect(iCalendarToIcsString(calendar, TEST_CONFIG)).toBe(
          icsDocument([
            'BEGIN:VCALENDAR',
            'PRODID:-//dereekb//dbx-components//EN',
            'VERSION:2.0',
            'CALSCALE:GREGORIAN',
            'BEGIN:VEVENT',
            'UID:event-1@example.com',
            'DTSTAMP:20260301T000000Z',
            'DTSTART:20260315T140000Z',
            'DTEND:20260315T150000Z',
            'SUMMARY:Standup',
            'STATUS:CANCELLED',
            'SEQUENCE:2',
            'END:VEVENT',
            'END:VCALENDAR'
          ])
        );
      });
    });

    describe('an event with an organizer and attendees', () => {
      it('should produce the expected document.', () => {
        const calendar: ICalendar = {
          events: [
            {
              uid: 'event-1@example.com',
              start: { type: 'utc', at: new Date('2026-03-15T14:00:00Z') },
              organizer: { address: 'organizer@example.com', name: 'The Organizer' },
              attendees: [{ address: 'a@example.com', name: 'Smith, John', role: 'REQ-PARTICIPANT', participationStatus: 'ACCEPTED', rsvp: true }, { address: 'mailto:b@example.com' }]
            }
          ]
        };

        expect(iCalendarToIcsString(calendar, TEST_CONFIG)).toBe(
          icsDocument([
            'BEGIN:VCALENDAR',
            'PRODID:-//dereekb//dbx-components//EN',
            'VERSION:2.0',
            'CALSCALE:GREGORIAN',
            'BEGIN:VEVENT',
            'UID:event-1@example.com',
            'DTSTAMP:20260301T000000Z',
            'DTSTART:20260315T140000Z',
            'ORGANIZER;CN=The Organizer:mailto:organizer@example.com',
            'ATTENDEE;CN="Smith, John";ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=TRUE:',
            ' mailto:a@example.com',
            'ATTENDEE:mailto:b@example.com',
            'END:VEVENT',
            'END:VCALENDAR'
          ])
        );
      });
    });

    describe('an event with an alarm', () => {
      it('should nest the VALARM inside the VEVENT.', () => {
        const calendar: ICalendar = {
          events: [
            {
              uid: 'event-1@example.com',
              start: { type: 'utc', at: new Date('2026-03-15T14:00:00Z') },
              alarms: [{ action: 'DISPLAY', triggerMinutesRelativeToStart: -15, description: 'Starting soon' }]
            }
          ]
        };

        expect(iCalendarToIcsString(calendar, TEST_CONFIG)).toBe(
          icsDocument([
            'BEGIN:VCALENDAR',
            'PRODID:-//dereekb//dbx-components//EN',
            'VERSION:2.0',
            'CALSCALE:GREGORIAN',
            'BEGIN:VEVENT',
            'UID:event-1@example.com',
            'DTSTAMP:20260301T000000Z',
            'DTSTART:20260315T140000Z',
            'BEGIN:VALARM',
            'ACTION:DISPLAY',
            'TRIGGER;RELATED=START:-PT15M',
            'DESCRIPTION:Starting soon',
            'END:VALARM',
            'END:VEVENT',
            'END:VCALENDAR'
          ])
        );
      });
    });

    describe('a zoned event with a derived VTIMEZONE', () => {
      it('should produce the expected document.', () => {
        const calendar: ICalendar = {
          events: [
            {
              uid: 'event-1@example.com',
              start: { type: 'zoned', at: new Date('2026-06-15T15:00:00Z'), timezone: 'America/Denver' },
              end: { type: 'zoned', at: new Date('2026-06-15T16:00:00Z'), timezone: 'America/Denver' }
            }
          ]
        };

        // a narrow window keeps the derived VTIMEZONE to the single observance the event falls inside
        expect(iCalendarToIcsString(iCalendarWithDerivedTimezones(calendar, { padding: 60 }), TEST_CONFIG)).toBe(
          icsDocument([
            'BEGIN:VCALENDAR',
            'PRODID:-//dereekb//dbx-components//EN',
            'VERSION:2.0',
            'CALSCALE:GREGORIAN',
            'BEGIN:VTIMEZONE',
            'TZID:America/Denver',
            'BEGIN:DAYLIGHT',
            'DTSTART:20260615T140000',
            'TZOFFSETFROM:-0600',
            'TZOFFSETTO:-0600',
            'TZNAME:MDT',
            'END:DAYLIGHT',
            'END:VTIMEZONE',
            'BEGIN:VEVENT',
            'UID:event-1@example.com',
            'DTSTAMP:20260301T000000Z',
            'DTSTART;TZID=America/Denver:20260615T090000',
            'DTEND;TZID=America/Denver:20260615T100000',
            'END:VEVENT',
            'END:VCALENDAR'
          ])
        );
      });
    });

    describe('folding and escaping together', () => {
      const description = 'Line one; with a comma, a backslash \\ and a colon: all in one.\nLine two, which keeps going and going and going until it must be folded across several physical lines.';

      it('should escape first and fold last.', () => {
        const ics = iCalendarToIcsString({ events: [{ uid: 'a@example.com', start: { type: 'utc', at: new Date('2026-03-15T14:00:00Z') }, description }] }, TEST_CONFIG);
        const lines = unfoldIcsString(ics);
        const descriptionLine = lines.find((x) => x.startsWith('DESCRIPTION:'));

        expect(descriptionLine).toBe(String.raw`DESCRIPTION:Line one\; with a comma\, a backslash \\ and a colon: all in one.\nLine two\, which keeps going and going and going until it must be folded across several physical lines.`);
      });

      it('should keep every physical line within 75 octets.', () => {
        const ics = iCalendarToIcsString({ events: [{ uid: 'a@example.com', start: { type: 'utc', at: new Date('2026-03-15T14:00:00Z') }, description, summary: '東京 🎉 café' }] }, TEST_CONFIG);

        ics
          .split(ICALENDAR_LINE_BREAK)
          .filter((x) => x.length > 0)
          .forEach((physicalLine) => {
            expect(new TextEncoder().encode(physicalLine).length).toBeLessThanOrEqual(75);
          });
      });
    });

    describe('byte stability', () => {
      const calendar: ICalendar = {
        name: 'Feed',
        events: [
          { uid: 'b@example.com', start: { type: 'utc', at: new Date('2026-03-16T14:00:00Z') }, summary: 'Second' },
          { uid: 'a@example.com', start: { type: 'utc', at: new Date('2026-03-15T14:00:00Z') }, summary: 'First' }
        ]
      };

      it('should produce identical output for the same model serialized twice.', () => {
        expect(iCalendarToIcsString(calendar, TEST_CONFIG)).toBe(iCalendarToIcsString(calendar, TEST_CONFIG));
      });

      it('should produce identical output when the model keys are declared in a different order.', () => {
        const reordered: ICalendar = {
          events: [
            { summary: 'Second', start: { at: new Date('2026-03-16T14:00:00Z'), type: 'utc' }, uid: 'b@example.com' },
            { summary: 'First', start: { at: new Date('2026-03-15T14:00:00Z'), type: 'utc' }, uid: 'a@example.com' }
          ],
          name: 'Feed'
        };

        expect(iCalendarToIcsString(reordered, TEST_CONFIG)).toBe(iCalendarToIcsString(calendar, TEST_CONFIG));
      });

      it('should preserve the event order given by the model.', () => {
        const lines = unfoldIcsString(iCalendarToIcsString(calendar, TEST_CONFIG));
        expect(lines.indexOf('UID:b@example.com')).toBeLessThan(lines.indexOf('UID:a@example.com'));
      });
    });

    describe('round trip through the RFC 5545 parser', () => {
      const calendar: ICalendar = {
        events: [
          {
            uid: 'event-1@example.com',
            start: { type: 'utc', at: new Date('2026-03-15T14:00:00Z') },
            end: { type: 'zoned', at: new Date('2026-03-15T15:00:00Z'), timezone: 'America/Denver' },
            summary: 'A summary, with a comma',
            categories: ['one', 'two']
          }
        ]
      };

      it('should re-parse every emitted line into a structured property.', () => {
        const lines = unfoldIcsString(iCalendarToIcsString(calendar, TEST_CONFIG));

        lines.forEach((line) => {
          const property = DateRRuleParseUtility.parseProperty(line);
          expect(property.type.length).toBeGreaterThan(0);
        });
      });

      it('should re-parse the emitted UTC DTSTART back to the original instant.', () => {
        const lines = unfoldIcsString(iCalendarToIcsString(calendar, TEST_CONFIG));
        const property = DateRRuleParseUtility.parseProperty(lines.find((x) => x.startsWith('DTSTART')) as string);

        expect(property.type).toBe('DTSTART');
        expect(property.params.length).toBe(0);
        expect(DateRRuleParseUtility.parseDateTimeString(property.values, undefined)).toBeSameSecondAs(new Date('2026-03-15T14:00:00Z'));
      });

      it('should re-parse the emitted zoned DTEND back to the original instant.', () => {
        const lines = unfoldIcsString(iCalendarToIcsString(calendar, TEST_CONFIG));
        const property = DateRRuleParseUtility.parseProperty(lines.find((x) => x.startsWith('DTEND')) as string);

        expect(property.type).toBe('DTEND');
        expect(property.params).toEqual([{ key: 'TZID', value: 'America/Denver' }]);
        expect(property.values).toBe('20260315T090000');

        // the emitted value is a wall clock in the TZID's zone, so recovering the instant means running the
        // package's own normalization over it. NOTE: DateRRuleParseUtility.parseDateTimeString() converts in
        // the opposite direction (it post-processes rrule output), so it is deliberately not used here.
        const wallClockAsUtc = DateRRuleParseUtility.parseDateTimeString(`${property.values}Z`, undefined);
        expect(targetDateToBaseDate(wallClockAsUtc, 'America/Denver')).toBeSameSecondAs(new Date('2026-03-15T15:00:00Z'));
      });
    });
  });
});
