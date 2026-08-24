import { type TimezoneString } from '@dereekb/util';
import { wrapDateTests } from '../../test.spec';
import { calendarDate, calendarDateForDateDurationSpan } from '../date/date.calendar';
import { type ICalendarDateOnly, type ICalendarUtcDateTime } from './icalendar.model';
import { iCalendarEventForCalendarDate, iCalendarEventForDateDurationSpan, iCalendarUidFactory } from './icalendar.factory';

/**
 * The zones that most aggressively expose an all-day off-by-one-day bug: west of UTC, far east of UTC, and
 * the two extremes of the date line.
 */
const ALL_DAY_TEST_TIMEZONES: readonly TimezoneString[] = ['America/Denver', 'Asia/Tokyo', 'Pacific/Kiritimati', 'UTC'];

wrapDateTests(() => {
  describe('iCalendarUidFactory()', () => {
    it('should build a UID from the key and domain.', () => {
      expect(iCalendarUidFactory({ domain: 'example.com' })('abc123')).toBe('abc123@example.com');
    });

    it('should apply the prefix.', () => {
      expect(iCalendarUidFactory({ domain: 'example.com', prefix: 'job' })('abc123')).toBe('job-abc123@example.com');
    });

    it('should be stable across calls for the same key.', () => {
      const factory = iCalendarUidFactory({ domain: 'example.com', prefix: 'job' });
      expect(factory('abc123')).toBe(factory('abc123'));
    });
  });

  describe('iCalendarEventForDateDurationSpan()', () => {
    it('should emit UTC endpoints derived from the span.', () => {
      const event = iCalendarEventForDateDurationSpan({ startsAt: new Date('2026-03-15T14:00:00Z'), duration: 90 }, { uid: 'a@example.com', summary: 'Standup' });

      expect(event.uid).toBe('a@example.com');
      expect(event.summary).toBe('Standup');
      expect(event.start.type).toBe('utc');
      expect((event.start as ICalendarUtcDateTime).at.toISOString()).toBe('2026-03-15T14:00:00.000Z');
      expect((event.end as ICalendarUtcDateTime).at.toISOString()).toBe('2026-03-15T15:30:00.000Z');
    });
  });

  describe('iCalendarEventForCalendarDate()', () => {
    describe('CalendarDateType.TIME', () => {
      it('should emit UTC endpoints and ignore the timezone.', () => {
        const event = iCalendarEventForCalendarDate(calendarDateForDateDurationSpan({ startsAt: new Date('2026-03-15T14:00:00Z'), duration: 60 }), { uid: 'a@example.com', timezone: 'America/Denver' });

        expect(event.start.type).toBe('utc');
        expect((event.start as ICalendarUtcDateTime).at.toISOString()).toBe('2026-03-15T14:00:00.000Z');
        expect((event.end as ICalendarUtcDateTime).at.toISOString()).toBe('2026-03-15T15:00:00.000Z');
      });

      it('should not leak the timezone config onto the event.', () => {
        const event = iCalendarEventForCalendarDate(calendarDateForDateDurationSpan({ startsAt: new Date('2026-03-15T14:00:00Z'), duration: 60 }), { uid: 'a@example.com', timezone: 'America/Denver' });
        expect('timezone' in event).toBe(false);
      });
    });

    describe('CalendarDateType.DAYS', () => {
      ALL_DAY_TEST_TIMEZONES.forEach((timezone) => {
        describe(`created in ${timezone}`, () => {
          const config = { uid: 'a@example.com', timezone: timezone === 'UTC' ? (false as const) : timezone };
          const sourceTimezone = timezone === 'UTC' ? (false as const) : timezone;

          it('should recover the calendar day of a one-day event.', () => {
            const event = iCalendarEventForCalendarDate(calendarDate('2024-01-15', 1, sourceTimezone), config);

            expect(event.start.type).toBe('date');
            expect((event.start as ICalendarDateOnly).day).toBe('2024-01-15');
          });

          it('should emit an EXCLUSIVE DTEND one day after a one-day event.', () => {
            const event = iCalendarEventForCalendarDate(calendarDate('2024-01-15', 1, sourceTimezone), config);
            expect((event.end as ICalendarDateOnly).day).toBe('2024-01-16');
          });

          it('should emit an EXCLUSIVE DTEND three days after a three-day event.', () => {
            const event = iCalendarEventForCalendarDate(calendarDate('2024-01-15', 3, sourceTimezone), config);

            expect((event.start as ICalendarDateOnly).day).toBe('2024-01-15');
            expect((event.end as ICalendarDateOnly).day).toBe('2024-01-18');
          });

          it('should cross a leap-year month boundary correctly.', () => {
            const event = iCalendarEventForCalendarDate(calendarDate('2024-02-28', 2, sourceTimezone), config);

            expect((event.start as ICalendarDateOnly).day).toBe('2024-02-28');
            expect((event.end as ICalendarDateOnly).day).toBe('2024-03-01');
          });

          it('should cross a non-leap-year month boundary correctly.', () => {
            const event = iCalendarEventForCalendarDate(calendarDate('2023-02-28', 2, sourceTimezone), config);

            expect((event.start as ICalendarDateOnly).day).toBe('2023-02-28');
            expect((event.end as ICalendarDateOnly).day).toBe('2023-03-02');
          });

          it('should cross a year boundary correctly.', () => {
            const event = iCalendarEventForCalendarDate(calendarDate('2024-12-31', 2, sourceTimezone), config);

            expect((event.start as ICalendarDateOnly).day).toBe('2024-12-31');
            expect((event.end as ICalendarDateOnly).day).toBe('2025-01-02');
          });

          it('should recover the calendar day of a date that falls inside a DST transition week.', () => {
            const event = iCalendarEventForCalendarDate(calendarDate('2024-03-10', 1, sourceTimezone), config);

            expect((event.start as ICalendarDateOnly).day).toBe('2024-03-10');
            expect((event.end as ICalendarDateOnly).day).toBe('2024-03-11');
          });

          it('should treat a zero-day event as a single day.', () => {
            const event = iCalendarEventForCalendarDate({ ...calendarDate('2024-01-15', 1, sourceTimezone), duration: 0 }, config);

            expect((event.start as ICalendarDateOnly).day).toBe('2024-01-15');
            expect((event.end as ICalendarDateOnly).day).toBe('2024-01-16');
          });
        });
      });
    });
  });
});
