import { describe, expect, it } from 'vitest';
import { UTC_TIMEZONE_STRING } from '@dereekb/util';
import { type Calendar, type CalendarEventItem, type CalendarRecurringEventItem, calendarConverter } from './calendar';
import { CalendarEventStatus, calendarIdForModel, inferCalendarRelatedModelKey } from './calendar.id';

const createdAt = new Date('2026-01-02T03:04:05.000Z');
const updatedAt = new Date('2026-01-02T05:04:05.000Z');

function eventItem(id: string, startsAt: Date, overrides?: Partial<CalendarEventItem>): CalendarEventItem {
  return {
    id,
    sa: startsAt,
    dur: 60,
    n: `Event ${id}`,
    cat: createdAt,
    uat: updatedAt,
    ...overrides
  };
}

function recurringEventItem(id: string, startsAt: Date, overrides?: Partial<CalendarRecurringEventItem>): CalendarRecurringEventItem {
  return {
    ...eventItem(id, startsAt),
    rr: 'RRULE:FREQ=WEEKLY;BYDAY=MO',
    ...overrides
  };
}

describe('calendarConverter', () => {
  const model: Calendar = {
    t: 'demo_profile',
    n: 'My Calendar',
    d: 'A description',
    tz: 'America/Denver',
    c: 'blue',
    o: 'pr/abc123',
    e: [eventItem('a', new Date('2026-03-15T14:00:00.000Z'), { l: 'Somewhere', u: 'https://example.com', st: CalendarEventStatus.CONFIRMED, q: 2, ca: ['work'] })],
    r: [recurringEventItem('b', new Date('2026-03-16T14:00:00.000Z'), { rea: new Date('2026-06-16T14:00:00.000Z'), rex: [1774274400] })],
    x: { calcolor: 'blue' },
    cat: createdAt,
    uat: updatedAt,
    s: true,
    sat: updatedAt,
    isf: 'sf123'
  };

  it('should round-trip the calendar and its embedded events', () => {
    const data = calendarConverter.mapFunctions.to(model);
    const result = calendarConverter.mapFunctions.from(data);

    expect(result.t).toBe('demo_profile');
    expect(result.n).toBe('My Calendar');
    expect(result.d).toBe('A description');
    expect(result.tz).toBe('America/Denver');
    expect(result.c).toBe('blue');
    expect(result.o).toBe('pr/abc123');
    expect(result.isf).toBe('sf123');
    expect(result.s).toBe(true);

    expect(result.e.length).toBe(1);
    expect(result.e[0].id).toBe('a');
    expect(result.e[0].sa).toBeSameSecondAs(model.e[0].sa);
    expect(result.e[0].dur).toBe(60);
    expect(result.e[0].l).toBe('Somewhere');
    expect(result.e[0].u).toBe('https://example.com');
    expect(result.e[0].st).toBe(CalendarEventStatus.CONFIRMED);
    expect(result.e[0].q).toBe(2);
    expect(result.e[0].ca).toEqual(['work']);

    expect(result.r.length).toBe(1);
    expect(result.r[0].rr).toBe('RRULE:FREQ=WEEKLY;BYDAY=MO');
    expect(result.r[0].rea).toBeSameSecondAs(model.r[0].rea as Date);
    expect(result.r[0].rex).toEqual([1774274400]);

    expect(result.x).toEqual({ calcolor: 'blue' });
  });

  it('should store embedded event dates as numbers and top-level dates as strings', () => {
    const data = calendarConverter.mapFunctions.to(model);

    expect(typeof data.e?.[0].sa).toBe('number');
    expect(typeof data.e?.[0].cat).toBe('number');
    expect(typeof data.e?.[0].uat).toBe('number');
    expect(typeof data.r?.[0].rea).toBe('number');
    expect(typeof data.cat).toBe('string');
    expect(typeof data.uat).toBe('string');
    expect(typeof data.sat).toBe('string');
  });

  it('should not store the boolean flags when they are false', () => {
    const data = calendarConverter.mapFunctions.to({ ...model, s: false, e: [eventItem('a', new Date('2026-03-15T14:00:00.000Z'), { ad: false })], r: [recurringEventItem('b', new Date('2026-03-16T14:00:00.000Z'), { rfe: false })] });

    // a cleared top-level optional stores the empty value; an embedded item drops the key entirely
    expect(data.s).toBeNull();
    expect(data.e?.[0].ad).not.toBeDefined();
    expect(data.r?.[0].rfe).not.toBeDefined();
    expect(calendarConverter.mapFunctions.from(data).s).toBeFalsy();
  });

  it('should sort the events ascending by start instant on write', () => {
    const data = calendarConverter.mapFunctions.to({
      ...model,
      e: [eventItem('late', new Date('2026-05-15T14:00:00.000Z')), eventItem('early', new Date('2026-03-15T14:00:00.000Z'))]
    });

    expect(data.e?.map((x: CalendarEventItem) => x.id)).toEqual(['early', 'late']);
  });

  it('should drop duplicate event ids on write', () => {
    const data = calendarConverter.mapFunctions.to({
      ...model,
      e: [eventItem('a', new Date('2026-03-15T14:00:00.000Z')), eventItem('a', new Date('2026-04-15T14:00:00.000Z'))]
    });

    expect(data.e?.length).toBe(1);
  });

  it('should omit the extension data when it is empty', () => {
    expect(calendarConverter.mapFunctions.to({ ...model, x: {} }).x).toBeNull();
  });

  it('should convert an empty document into empty arrays and a UTC timezone', () => {
    const result = calendarConverter.mapFunctions.from({});

    expect(result.e).toEqual([]);
    expect(result.r).toEqual([]);
    // regression guard: firestoreTimezoneString() used to default to the LatLng default of "0,0"
    expect(result.tz).toBe(UTC_TIMEZONE_STRING);
  });
});

describe('calendarIdForModel()', () => {
  it('should round-trip a model key through the calendar id', () => {
    const calendarId = calendarIdForModel('pr/abc123');

    expect(calendarId).toBe('pr_abc123');
    expect(inferCalendarRelatedModelKey(calendarId)).toBe('pr/abc123');
  });
});

describe('calendarEventItem model key field', () => {
  it('should round trip a model key on both event kinds', () => {
    const model: Calendar = {
      t: 'demo_profile',
      n: 'My Calendar',
      tz: UTC_TIMEZONE_STRING,
      e: [eventItem('a', new Date('2026-03-15T14:00:00.000Z'), { m: 'jl/loc/job/abc' })],
      r: [recurringEventItem('b', new Date('2026-03-16T14:00:00.000Z'), { m: 'jl/loc/job/xyz' })],
      cat: createdAt,
      uat: updatedAt
    };

    const data = calendarConverter.mapFunctions.to(model);
    const back = calendarConverter.mapFunctions.from(data);

    expect(back.e[0].m).toBe('jl/loc/job/abc');
    expect(back.r[0].m).toBe('jl/loc/job/xyz');
  });

  it('should cost nothing in the stored document when absent', () => {
    const model: Calendar = {
      t: 'demo_profile',
      n: 'My Calendar',
      tz: UTC_TIMEZONE_STRING,
      e: [eventItem('a', new Date('2026-03-15T14:00:00.000Z'))],
      r: [],
      cat: createdAt,
      uat: updatedAt
    };

    const data = calendarConverter.mapFunctions.to(model) as unknown as { readonly e: Record<string, unknown>[] };
    expect('m' in data.e[0]).toBe(false);
  });
});
