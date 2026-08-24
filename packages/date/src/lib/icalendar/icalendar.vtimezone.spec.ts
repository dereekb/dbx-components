import { wrapDateTests } from '../../test.spec';
import { type ICalendar } from './icalendar.model';
import { iCalendarReferencedTimezones, iCalendarTimezoneForRange, iCalendarTimezoneTransitionsForRange, iCalendarWithDerivedTimezones } from './icalendar.vtimezone';

wrapDateTests(() => {
  describe('iCalendarTimezoneTransitionsForRange()', () => {
    it('should derive the two US DST transitions of a calendar year.', () => {
      const transitions = iCalendarTimezoneTransitionsForRange({ timezone: 'America/Denver', start: new Date('2026-01-01T00:00:00Z'), end: new Date('2026-12-31T00:00:00Z') });

      // the observance in effect at the start of the window, plus the spring-forward and fall-back transitions
      expect(transitions.length).toBe(3);
      expect(transitions[0].daylight).toBe(false);
      expect(transitions[0].offsetTo).toBe(-420);

      expect(transitions[1].daylight).toBe(true);
      expect(transitions[1].offsetFrom).toBe(-420);
      expect(transitions[1].offsetTo).toBe(-360);
      // 2026 DST starts at 2am local on March 8, which is 09:00 UTC
      expect(transitions[1].startsAt.toISOString()).toBe('2026-03-08T09:00:00.000Z');

      expect(transitions[2].daylight).toBe(false);
      expect(transitions[2].offsetFrom).toBe(-360);
      expect(transitions[2].offsetTo).toBe(-420);
      // 2026 DST ends at 2am local on November 1, which is 08:00 UTC
      expect(transitions[2].startsAt.toISOString()).toBe('2026-11-01T08:00:00.000Z');
    });

    it('should name the observances.', () => {
      const transitions = iCalendarTimezoneTransitionsForRange({ timezone: 'America/Denver', start: new Date('2026-01-01T00:00:00Z'), end: new Date('2026-12-31T00:00:00Z') });

      expect(transitions[0].name).toBe('MST');
      expect(transitions[1].name).toBe('MDT');
      expect(transitions[2].name).toBe('MST');
    });

    it('should derive a single standard observance for a zone with no DST.', () => {
      const transitions = iCalendarTimezoneTransitionsForRange({ timezone: 'Asia/Tokyo', start: new Date('2026-01-01T00:00:00Z'), end: new Date('2026-12-31T00:00:00Z') });

      expect(transitions.length).toBe(1);
      expect(transitions[0].daylight).toBe(false);
      expect(transitions[0].offsetTo).toBe(540);
    });

    it('should derive the southern-hemisphere transitions of a calendar year.', () => {
      const transitions = iCalendarTimezoneTransitionsForRange({ timezone: 'Pacific/Auckland', start: new Date('2026-01-01T00:00:00Z'), end: new Date('2026-12-31T00:00:00Z') });

      // the window opens inside NZDT, so the initial observance is the daylight one
      expect(transitions.length).toBe(3);
      expect(transitions[0].daylight).toBe(true);
      expect(transitions[0].offsetTo).toBe(780);
      expect(transitions[1].daylight).toBe(false);
      expect(transitions[1].offsetTo).toBe(720);
      expect(transitions[2].daylight).toBe(true);
      expect(transitions[2].offsetTo).toBe(780);
    });

    it('should return exactly one observance for a window shorter than a day.', () => {
      const transitions = iCalendarTimezoneTransitionsForRange({ timezone: 'America/Denver', start: new Date('2026-06-01T00:00:00Z'), end: new Date('2026-06-01T06:00:00Z') });

      expect(transitions.length).toBe(1);
      expect(transitions[0].offsetTo).toBe(-360);
    });

    it('should handle UTC.', () => {
      const transitions = iCalendarTimezoneTransitionsForRange({ timezone: 'UTC', start: new Date('2026-01-01T00:00:00Z'), end: new Date('2026-12-31T00:00:00Z') });

      expect(transitions.length).toBe(1);
      expect(transitions[0].offsetFrom).toBe(0);
      expect(transitions[0].offsetTo).toBe(0);
    });
  });

  describe('iCalendarTimezoneForRange()', () => {
    it('should carry the TZID and its transitions.', () => {
      const timezone = iCalendarTimezoneForRange({ timezone: 'America/Denver', start: new Date('2026-06-01T00:00:00Z'), end: new Date('2026-06-02T00:00:00Z') });

      expect(timezone.timezone).toBe('America/Denver');
      expect(timezone.transitions.length).toBeGreaterThan(0);
    });
  });

  describe('iCalendarReferencedTimezones()', () => {
    it('should return nothing when every event is UTC or all-day.', () => {
      const calendar: ICalendar = {
        events: [
          { uid: 'a', start: { type: 'utc', at: new Date('2026-03-15T14:00:00Z') } },
          { uid: 'b', start: { type: 'date', day: '2026-03-15' } }
        ]
      };

      expect(iCalendarReferencedTimezones(calendar)).toEqual([]);
    });

    it('should return each distinct referenced zone once.', () => {
      const calendar: ICalendar = {
        events: [
          { uid: 'a', start: { type: 'zoned', at: new Date('2026-03-15T14:00:00Z'), timezone: 'America/Denver' }, end: { type: 'zoned', at: new Date('2026-03-15T15:00:00Z'), timezone: 'America/Denver' } },
          { uid: 'b', start: { type: 'zoned', at: new Date('2026-03-15T14:00:00Z'), timezone: 'Asia/Tokyo' } }
        ]
      };

      expect(iCalendarReferencedTimezones(calendar)).toEqual(['America/Denver', 'Asia/Tokyo']);
    });
  });

  describe('iCalendarWithDerivedTimezones()', () => {
    it('should return the calendar unchanged when nothing references a zone.', () => {
      const calendar: ICalendar = { events: [{ uid: 'a', start: { type: 'utc', at: new Date('2026-03-15T14:00:00Z') } }] };
      expect(iCalendarWithDerivedTimezones(calendar)).toBe(calendar);
    });

    it('should derive one VTIMEZONE per referenced zone.', () => {
      const calendar: ICalendar = {
        events: [
          { uid: 'a', start: { type: 'zoned', at: new Date('2026-03-15T14:00:00Z'), timezone: 'America/Denver' } },
          { uid: 'b', start: { type: 'zoned', at: new Date('2026-03-15T14:00:00Z'), timezone: 'Asia/Tokyo' } }
        ]
      };

      const result = iCalendarWithDerivedTimezones(calendar, { padding: 60 });

      expect(result.timezones?.length).toBe(2);
      expect(result.timezones?.map((x) => x.timezone)).toEqual(['America/Denver', 'Asia/Tokyo']);
      expect(result.events).toBe(calendar.events);
    });
  });
});
