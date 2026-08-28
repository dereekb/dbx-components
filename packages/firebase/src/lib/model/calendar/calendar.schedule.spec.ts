import { describe, expect, it } from 'vitest';
import { addMinutes } from 'date-fns';
import { type FullDateCellScheduleRange, type DateCellSchedule, dateCellTiming, dateTimezoneUtcNormal, expandDateCellScheduleRange } from '@dereekb/date';
import { expandCalendarEvents } from './calendar.expand';
import { calendarRecurringEventItemForScheduleRange } from './calendar.schedule';

const NOW = new Date('2026-03-01T00:00:00.000Z');
const TIMEZONE = 'America/Chicago';

/**
 * Builds a range starting at the given wall clock in TIMEZONE.
 */
function scheduleRange(schedule: DateCellSchedule, days: number, hours = 11): FullDateCellScheduleRange {
  const startsAt = dateTimezoneUtcNormal(TIMEZONE).targetDateToBaseDate(new Date(Date.UTC(2026, 2, 2, hours, 0, 0)));
  const timing = dateCellTiming({ startsAt, duration: 60 }, days, TIMEZONE);
  return { ...timing, ...schedule };
}

describe('calendarRecurringEventItemForScheduleRange()', () => {
  it('should build a recurring event whose occurrences match the schedule expansion', () => {
    const range = scheduleRange({ w: '8' }, 19);
    const item = calendarRecurringEventItemForScheduleRange({ range, id: 'job1', name: 'Shift', now: NOW });

    expect(item).not.toBeUndefined();

    const expected = expandDateCellScheduleRange({ dateCellScheduleRange: range }).map((x) => x.startsAt.toISOString());
    const occurrences = expandCalendarEvents({
      calendar: { tz: TIMEZONE, e: [], r: [item!] },
      range: { start: new Date('2026-01-01T00:00:00.000Z'), end: new Date('2027-01-01T00:00:00.000Z') }
    });

    expect(occurrences.map((x) => x.startsAt.toISOString())).toEqual(expected);
  });

  it('should carry exclusions in rex rather than in rr, so the ICS does not emit them twice', () => {
    const range = scheduleRange({ w: '89', ex: [2] }, 5);
    const item = calendarRecurringEventItemForScheduleRange({ range, id: 'job1', name: 'Shift', now: NOW });

    expect(item?.rr).not.toContain('EXDATE');
    expect(item?.rex?.length).toBe(1);
  });

  it('should still honour the exclusion when expanding through rex', () => {
    const range = scheduleRange({ w: '89', ex: [2] }, 5);
    const item = calendarRecurringEventItemForScheduleRange({ range, id: 'job1', name: 'Shift', now: NOW });

    const expected = expandDateCellScheduleRange({ dateCellScheduleRange: range }).map((x) => x.startsAt.toISOString());
    const occurrences = expandCalendarEvents({
      calendar: { tz: TIMEZONE, e: [], r: [item!] },
      range: { start: new Date('2026-01-01T00:00:00.000Z'), end: new Date('2027-01-01T00:00:00.000Z') }
    });

    expect(occurrences.map((x) => x.startsAt.toISOString())).toEqual(expected);
  });

  it('should keep an RDATE line in rr, since rex has no additive counterpart', () => {
    // Mondays only; index 3 is a Thursday forced in by `d`.
    const range = scheduleRange({ w: '2', d: [3] }, 15);
    const item = calendarRecurringEventItemForScheduleRange({ range, id: 'job1', name: 'Shift', now: NOW });

    expect(item?.rr).toContain('RDATE:');

    const expected = expandDateCellScheduleRange({ dateCellScheduleRange: range }).map((x) => x.startsAt.toISOString());
    const occurrences = expandCalendarEvents({
      calendar: { tz: TIMEZONE, e: [], r: [item!] },
      range: { start: new Date('2026-01-01T00:00:00.000Z'), end: new Date('2027-01-01T00:00:00.000Z') }
    });

    expect(occurrences.map((x) => x.startsAt.toISOString())).toEqual(expected);
  });

  it('should anchor sa on the first real occurrence and set rea to the last', () => {
    // 2026-03-02 is a Monday, so a weekend-only schedule starts on the 7th.
    const range = scheduleRange({ w: '9' }, 19);
    const item = calendarRecurringEventItemForScheduleRange({ range, id: 'job1', name: 'Shift', now: NOW });
    const expected = expandDateCellScheduleRange({ dateCellScheduleRange: range });

    expect(item?.sa.toISOString()).toBe(expected[0].startsAt.toISOString());
    expect(item?.rea?.toISOString()).toBe(addMinutes(expected[expected.length - 1].startsAt, 60).toISOString());
    expect(item?.rfe).toBeUndefined();
  });

  it('should set the model key so the event can be replaced as a set', () => {
    const range = scheduleRange({ w: '8' }, 19);
    const item = calendarRecurringEventItemForScheduleRange({ range, id: 'job1', modelKey: 'jl/loc/job/abc', name: 'Shift', now: NOW });

    expect(item?.m).toBe('jl/loc/job/abc');
  });

  it('should map the display metadata onto the event', () => {
    const range = scheduleRange({ w: '8' }, 19);
    const item = calendarRecurringEventItemForScheduleRange({
      range,
      id: 'job1',
      name: 'Shift',
      description: 'A shift',
      location: 'Somewhere',
      url: 'https://example.com',
      categories: ['work'],
      now: NOW
    });

    expect(item?.n).toBe('Shift');
    expect(item?.d).toBe('A shift');
    expect(item?.l).toBe('Somewhere');
    expect(item?.u).toBe('https://example.com');
    expect(item?.ca).toEqual(['work']);
    expect(item?.dur).toBe(60);
    expect(item?.tz).toBe(TIMEZONE);
  });

  it('should return undefined when the schedule has no occurrences', () => {
    expect(calendarRecurringEventItemForScheduleRange({ range: scheduleRange({ w: '' }, 19), id: 'job1', name: 'Shift', now: NOW })).toBeUndefined();
    expect(calendarRecurringEventItemForScheduleRange({ range: scheduleRange({ w: '89', ex: [0, 1, 2] }, 3), id: 'job1', name: 'Shift', now: NOW })).toBeUndefined();
  });
});
