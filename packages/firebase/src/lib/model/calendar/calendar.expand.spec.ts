import { describe, expect, it } from 'vitest';
import { addDays, subDays } from 'date-fns';
import { type DateRange } from '@dereekb/date';
import { unixDateTimeSecondsNumberFromDate } from '@dereekb/util';
import { type Calendar, type CalendarEventItem, type CalendarRecurringEventItem } from './calendar';
import { expandCalendarEvents } from './calendar.expand';

const NOW = new Date('2026-03-01T00:00:00.000Z');

function eventItem(id: string, startsAt: Date, overrides?: Partial<CalendarEventItem>): CalendarEventItem {
  return { id, sa: startsAt, dur: 60, n: `Event ${id}`, cat: NOW, uat: NOW, ...overrides };
}

function recurringEventItem(id: string, startsAt: Date, overrides?: Partial<CalendarRecurringEventItem>): CalendarRecurringEventItem {
  return { ...eventItem(id, startsAt), rr: 'RRULE:FREQ=WEEKLY;BYDAY=MO', ...overrides };
}

function calendarWith(input: Partial<Pick<Calendar, 'tz' | 'e' | 'r'>>): Pick<Calendar, 'tz' | 'e' | 'r'> {
  return { tz: 'UTC', e: [], r: [], ...input };
}

const WIDE_RANGE: DateRange = { start: subDays(NOW, 365), end: addDays(NOW, 365) };

describe('expandCalendarEvents()', () => {
  it('should include a one-off event that overlaps the range', () => {
    const occurrences = expandCalendarEvents({ calendar: calendarWith({ e: [eventItem('a', NOW)] }), range: WIDE_RANGE });

    expect(occurrences.length).toBe(1);
    expect(occurrences[0].key).toBe('a');
    expect(occurrences[0].recurring).toBe(false);
    expect(occurrences[0].endsAt.getTime()).toBe(NOW.getTime() + 60 * 60 * 1000);
  });

  it('should clip a one-off event that sits outside the range', () => {
    const occurrences = expandCalendarEvents({ calendar: calendarWith({ e: [eventItem('far', addDays(NOW, 500))] }), range: WIDE_RANGE });

    expect(occurrences).toEqual([]);
  });

  it('should expand a weekly recurrence across a DST boundary in America/Denver without drifting the wall clock', () => {
    // 2026-03-08 is the US DST transition; a Monday 09:00 America/Denver series must stay at 09:00 local
    const startsAt = new Date('2026-03-02T16:00:00.000Z'); // 09:00 MST
    const range: DateRange = { start: new Date('2026-03-01T00:00:00.000Z'), end: new Date('2026-03-31T00:00:00.000Z') };

    const occurrences = expandCalendarEvents({
      calendar: calendarWith({ tz: 'America/Denver', r: [recurringEventItem('weekly', startsAt, { tz: 'America/Denver' })] }),
      range
    });

    expect(occurrences.length).toBeGreaterThan(2);

    const localHours = occurrences.map((x) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Denver', hour: 'numeric', hour12: false }).format(x.startsAt));
    expect(new Set(localHours).size).toBe(1);
  });

  it('should exclude occurrences named in rex', () => {
    const startsAt = new Date('2026-03-02T16:00:00.000Z');
    const range: DateRange = { start: new Date('2026-03-01T00:00:00.000Z'), end: new Date('2026-03-31T00:00:00.000Z') };

    const withAll = expandCalendarEvents({ calendar: calendarWith({ r: [recurringEventItem('weekly', startsAt)] }), range });
    const excluded = withAll[1].startsAt;

    const withExclusion = expandCalendarEvents({
      calendar: calendarWith({ r: [recurringEventItem('weekly', startsAt, { rex: [unixDateTimeSecondsNumberFromDate(excluded)] })] }),
      range
    });

    expect(withExclusion.length).toBe(withAll.length - 1);
    expect(withExclusion.map((x) => x.startsAt.getTime())).not.toContain(excluded.getTime());
  });

  it('should mark an all-day event as all-day', () => {
    const occurrences = expandCalendarEvents({ calendar: calendarWith({ e: [eventItem('a', NOW, { ad: true, dur: 1440 })] }), range: WIDE_RANGE });

    expect(occurrences[0].allDay).toBe(true);
  });

  it('should honour the include filters', () => {
    const calendar = calendarWith({ e: [eventItem('a', NOW)], r: [recurringEventItem('weekly', NOW)] });

    expect(expandCalendarEvents({ calendar, range: WIDE_RANGE, includeRecurringEvents: false }).every((x) => !x.recurring)).toBe(true);
    expect(expandCalendarEvents({ calendar, range: WIDE_RANGE, includeOneOffEvents: false }).every((x) => x.recurring)).toBe(true);
  });

  it('should cap a single recurring event with maxOccurrencesPerEvent', () => {
    const occurrences = expandCalendarEvents({ calendar: calendarWith({ r: [recurringEventItem('weekly', NOW)] }), range: WIDE_RANGE, maxOccurrencesPerEvent: 3 });

    expect(occurrences.length).toBe(3);
  });

  it('should produce stable occurrence keys across calls', () => {
    const calendar = calendarWith({ r: [recurringEventItem('weekly', NOW)] });

    expect(expandCalendarEvents({ calendar, range: WIDE_RANGE }).map((x) => x.key)).toEqual(expandCalendarEvents({ calendar, range: WIDE_RANGE }).map((x) => x.key));
  });

  it('should not mutate the caller-supplied range across events', () => {
    const range: DateRange = { start: subDays(NOW, 30), end: addDays(NOW, 30) };
    const start = range.start.getTime();
    const end = range.end.getTime();

    expandCalendarEvents({
      calendar: calendarWith({ tz: 'America/Denver', r: [recurringEventItem('a', NOW, { tz: 'America/Denver' }), recurringEventItem('b', NOW, { tz: 'America/Denver' })] }),
      range
    });

    expect(range.start.getTime()).toBe(start);
    expect(range.end.getTime()).toBe(end);
  });

  it('should throw for a forever recurrence expanded with no range', () => {
    expect(() =>
      expandCalendarEvents({
        calendar: calendarWith({ r: [recurringEventItem('weekly', NOW)] }),
        range: undefined as unknown as DateRange
      })
    ).toThrow();
  });

  it('should return the occurrences sorted ascending by start instant', () => {
    const occurrences = expandCalendarEvents({
      calendar: calendarWith({ e: [eventItem('late', addDays(NOW, 20)), eventItem('early', subDays(NOW, 20))] }),
      range: WIDE_RANGE
    });

    expect(occurrences.map((x) => x.key)).toEqual(['early', 'late']);
  });
});
