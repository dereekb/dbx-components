import { describe, expect, it } from 'vitest';
import { addDays, subDays } from 'date-fns';
import { ModelRecurrenceInfoUtility } from '@dereekb/date';
import { type CalendarEventItem, type CalendarRecurringEventItem } from './calendar';
import { CalendarEventStatus } from './calendar.id';
import { type CalendarTypeConfig } from './calendar.type';
import { calendarEventItemsForModelKey, calendarRecurringEventItemModelRecurrenceInfo, calendarRecurringEventItemRecurrenceFields, calendarTemplate, markCalendarForSyncTemplate, pruneCalendarEvents, removeCalendarEventItems, replaceCalendarEventItemsForModelKey, updateCalendarEventsTemplate, upsertCalendarEventItems } from './calendar.util';

const NOW = new Date('2026-03-01T00:00:00.000Z');

function eventItem(id: string, startsAt: Date, overrides?: Partial<CalendarEventItem>): CalendarEventItem {
  return {
    id,
    sa: startsAt,
    dur: 60,
    n: `Event ${id}`,
    cat: NOW,
    uat: NOW,
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

describe('calendarTemplate()', () => {
  it('should flag the new calendar for sync so the next sweep picks it up', () => {
    expect(calendarTemplate({ calendarType: 'demo', name: 'A', now: NOW }).s).toBe(true);
  });

  it('should default to UTC and empty event arrays', () => {
    const calendar = calendarTemplate({ calendarType: 'demo', name: 'A', now: NOW });

    expect(calendar.tz).toBe('UTC');
    expect(calendar.e).toEqual([]);
    expect(calendar.r).toEqual([]);
    expect(calendar.cat).toBe(NOW);
    expect(calendar.uat).toBe(NOW);
  });
});

describe('markCalendarForSyncTemplate()', () => {
  it('should flag for sync and move the updated instant', () => {
    expect(markCalendarForSyncTemplate(NOW)).toEqual({ s: true, uat: NOW });
  });
});

describe('upsertCalendarEventItems()', () => {
  const existing = eventItem('a', new Date('2026-03-15T14:00:00.000Z'));

  it('should insert an item whose id is not present yet', () => {
    const later = new Date('2026-03-02T00:00:00.000Z');
    const result = upsertCalendarEventItems([existing], [{ id: 'b', sa: new Date('2026-03-16T14:00:00.000Z'), dur: 30, n: 'B' }], { now: later });

    expect(result.length).toBe(2);
    expect(result.map((x) => x.id)).toEqual(['a', 'b']);
    expect(result[1].cat).toBe(later);
    expect(result[1].uat).toBe(later);
  });

  it('should bump the sequence and the updated instant on an actual change', () => {
    const later = new Date('2026-03-02T00:00:00.000Z');
    const result = upsertCalendarEventItems([existing], [{ id: 'a', n: 'Renamed' }], { now: later });

    expect(result[0].n).toBe('Renamed');
    expect(result[0].q).toBe(1);
    expect(result[0].uat).toBe(later);
  });

  it('should leave the item untouched when nothing changed', () => {
    const later = new Date('2026-03-02T00:00:00.000Z');
    const result = upsertCalendarEventItems([existing], [{ id: 'a', n: existing.n }], { now: later });

    expect(result[0]).toBe(existing);
    expect(result[0].q).not.toBeDefined();
    expect(result[0].uat).toBe(NOW);
  });

  it('should keep the result sorted ascending by start instant', () => {
    const result = upsertCalendarEventItems([existing], [{ id: 'early', sa: new Date('2026-01-01T00:00:00.000Z'), dur: 30, n: 'E' }], { now: NOW });

    expect(result.map((x) => x.id)).toEqual(['early', 'a']);
  });
});

describe('removeCalendarEventItems()', () => {
  const existing = eventItem('a', new Date('2026-03-15T14:00:00.000Z'));

  it('should tombstone the item as CANCELLED by default', () => {
    const result = removeCalendarEventItems([existing], 'a', { now: NOW });

    expect(result.length).toBe(1);
    expect(result[0].st).toBe(CalendarEventStatus.CANCELLED);
    expect(result[0].q).toBe(1);
  });

  it('should not re-bump an item that is already cancelled', () => {
    const cancelled = eventItem('a', new Date('2026-03-15T14:00:00.000Z'), { st: CalendarEventStatus.CANCELLED, q: 4 });
    expect(removeCalendarEventItems([cancelled], 'a', { now: NOW })[0].q).toBe(4);
  });

  it('should splice the item out under hard: true', () => {
    expect(removeCalendarEventItems([existing], 'a', { hard: true })).toEqual([]);
  });

  it('should accept an array of ids', () => {
    const items = [existing, eventItem('b', new Date('2026-03-16T14:00:00.000Z'))];
    expect(removeCalendarEventItems(items, ['a', 'b'], { hard: true })).toEqual([]);
  });
});

describe('updateCalendarEventsTemplate()', () => {
  it('should always flag for sync and move the updated instant', () => {
    const template = updateCalendarEventsTemplate({ calendar: { e: [], r: [] }, now: NOW });

    expect(template.s).toBe(true);
    expect(template.uat).toBe(NOW);
  });

  it('should apply the upserts to the matching array', () => {
    const template = updateCalendarEventsTemplate({
      calendar: { e: [], r: [] },
      upsertEvents: [{ id: 'a', sa: NOW, dur: 30, n: 'A' }],
      upsertRecurringEvents: [{ id: 'b', sa: NOW, dur: 30, n: 'B', rr: 'RRULE:FREQ=DAILY' }],
      now: NOW
    });

    expect(template.e.map((x) => x.id)).toEqual(['a']);
    expect(template.r.map((x) => x.id)).toEqual(['b']);
    expect(template.r[0].rr).toBe('RRULE:FREQ=DAILY');
  });

  it('should remove ids from both arrays', () => {
    const template = updateCalendarEventsTemplate({
      calendar: { e: [eventItem('a', NOW)], r: [recurringEventItem('b', NOW)] },
      removeEventIds: ['a', 'b'],
      hardRemove: true,
      now: NOW
    });

    expect(template.e).toEqual([]);
    expect(template.r).toEqual([]);
  });
});

describe('pruneCalendarEvents()', () => {
  const config: CalendarTypeConfig = { calendarType: 'demo', retainPastEventDays: 30, maxEvents: 10 };

  it('should drop a one-off event whose end instant is before the past cutoff', () => {
    const result = pruneCalendarEvents({ calendar: { e: [eventItem('old', subDays(NOW, 60)), eventItem('recent', subDays(NOW, 5))], r: [] }, config, now: NOW });

    expect(result.e.map((x) => x.id)).toEqual(['recent']);
    expect(result.prunedEventCount).toBe(1);
    expect(result.changed).toBe(true);
  });

  it('should drop a recurrence whose series ended before the cutoff', () => {
    const result = pruneCalendarEvents({ calendar: { e: [], r: [recurringEventItem('ended', subDays(NOW, 90), { rea: subDays(NOW, 60) })] }, config, now: NOW });

    expect(result.r).toEqual([]);
    expect(result.prunedRecurringEventCount).toBe(1);
  });

  it('should never drop a forever recurrence', () => {
    const result = pruneCalendarEvents({ calendar: { e: [], r: [recurringEventItem('forever', subDays(NOW, 900), { rfe: true, rea: subDays(NOW, 800) })] }, config, now: NOW });

    expect(result.r.map((x) => x.id)).toEqual(['forever']);
  });

  it('should keep an ended recurrence when pruneEndedRecurrences is false', () => {
    const result = pruneCalendarEvents({ calendar: { e: [], r: [recurringEventItem('ended', subDays(NOW, 90), { rea: subDays(NOW, 60) })] }, config: { ...config, pruneEndedRecurrences: false }, now: NOW });

    expect(result.r.map((x) => x.id)).toEqual(['ended']);
    expect(result.changed).toBe(false);
  });

  it('should drop the oldest one-off events first when over maxEvents, and never a future one before a past one', () => {
    const events = [eventItem('p1', subDays(NOW, 20)), eventItem('p2', subDays(NOW, 10)), eventItem('f1', addDays(NOW, 10))];
    const result = pruneCalendarEvents({ calendar: { e: events, r: [] }, config: { ...config, maxEvents: 2 }, now: NOW });

    expect(result.e.map((x) => x.id)).toEqual(['p2', 'f1']);
  });

  it('should report changed as false when nothing was dropped', () => {
    const result = pruneCalendarEvents({ calendar: { e: [eventItem('recent', subDays(NOW, 5))], r: [] }, config, now: NOW });

    expect(result.changed).toBe(false);
    expect(result.prunedEventCount).toBe(0);
    expect(result.prunedRecurringEventCount).toBe(0);
  });
});

describe('calendarRecurringEventItemModelRecurrenceInfo()', () => {
  it('should round-trip against the recurrence fields', () => {
    const item = recurringEventItem('a', new Date('2026-03-16T14:00:00.000Z'), { tz: 'America/Denver', rea: new Date('2026-06-16T14:00:00.000Z') });

    const info = calendarRecurringEventItemModelRecurrenceInfo(item, 'UTC');
    const fields = calendarRecurringEventItemRecurrenceFields(info);

    expect(fields.sa).toBe(item.sa);
    expect(fields.tz).toBe('America/Denver');
    expect(fields.rr).toBe(item.rr);
    expect(fields.rea).toBe(item.rea);
    expect(fields.rfe).not.toBeDefined();
  });

  it('should mark a forever recurrence and drop its end instant', () => {
    const item = recurringEventItem('a', new Date('2026-03-16T14:00:00.000Z'), { rfe: true });
    const fields = calendarRecurringEventItemRecurrenceFields(calendarRecurringEventItemModelRecurrenceInfo(item, 'UTC'));

    expect(fields.rfe).toBe(true);
    expect(fields.rea).not.toBeDefined();
  });

  it('should agree with ModelRecurrenceInfoUtility about a bounded series', () => {
    const startsAt = new Date('2026-03-16T14:00:00.000Z');
    const expanded = ModelRecurrenceInfoUtility.expandModelRecurrenceStartToModelRecurrenceInfo({
      rrule: ['RRULE:FREQ=WEEKLY;COUNT=4'],
      date: { type: 'time' as never, startsAt, duration: 60 }
    });

    const fields = calendarRecurringEventItemRecurrenceFields(expanded);
    const item = recurringEventItem('a', fields.sa, { rr: fields.rr, rea: fields.rea, rfe: fields.rfe });
    const roundTripped = calendarRecurringEventItemModelRecurrenceInfo(item, 'UTC');

    expect(roundTripped.rrule).toBe(expanded.rrule);
    expect(roundTripped.start).toEqual(expanded.start);
    expect(roundTripped.forever).toBe(false);
  });
});

describe('model key targeting', () => {
  const JOB_KEY = 'jl/loc/job/abc';
  const OTHER_KEY = 'jl/loc/job/xyz';
  const day = (n: number) => addDays(NOW, n);

  describe('calendarEventItemsForModelKey()', () => {
    it('should return only the events carrying the key', () => {
      const items = [eventItem('a', day(1), { m: JOB_KEY }), eventItem('b', day(2), { m: OTHER_KEY }), eventItem('c', day(3))];

      expect(calendarEventItemsForModelKey(items, JOB_KEY).map((x) => x.id)).toEqual(['a']);
    });
  });

  describe('replaceCalendarEventItemsForModelKey()', () => {
    it('should stamp the key onto every replacement so the next replace can find them', () => {
      const result = replaceCalendarEventItemsForModelKey([], { modelKey: JOB_KEY, items: [eventItem('a', day(1))], now: NOW });

      expect(result.length).toBe(1);
      expect(result[0].m).toBe(JOB_KEY);
    });

    it('should leave events belonging to another key untouched', () => {
      const other = eventItem('b', day(2), { m: OTHER_KEY });
      const untagged = eventItem('c', day(3));
      const result = replaceCalendarEventItemsForModelKey([other, untagged], { modelKey: JOB_KEY, items: [eventItem('a', day(1))], now: NOW });

      expect(result.find((x) => x.id === 'b')).toEqual(other);
      expect(result.find((x) => x.id === 'c')).toEqual(untagged);
    });

    it('should tombstone an event the replacement dropped rather than splicing it out', () => {
      const stale = eventItem('a', day(1), { m: JOB_KEY });
      const result = replaceCalendarEventItemsForModelKey([stale], { modelKey: JOB_KEY, items: [eventItem('b', day(2))], now: NOW });

      const dropped = result.find((x) => x.id === 'a');
      expect(dropped).not.toBeUndefined();
      expect(dropped?.st).toBe(CalendarEventStatus.CANCELLED);
      expect(dropped?.q).toBe(1);
    });

    it('should splice a dropped event out when hard is set', () => {
      const stale = eventItem('a', day(1), { m: JOB_KEY });
      const result = replaceCalendarEventItemsForModelKey([stale], { modelKey: JOB_KEY, items: [eventItem('b', day(2))], hard: true, now: NOW });

      expect(result.map((x) => x.id)).toEqual(['b']);
    });

    it('should keep a surviving event byte-identical when nothing observable changed', () => {
      const existing = eventItem('a', day(1), { m: JOB_KEY });
      const result = replaceCalendarEventItemsForModelKey([existing], { modelKey: JOB_KEY, items: [existing], now: addDays(NOW, 10) });

      expect(result).toEqual([existing]);
    });

    it('should not bump the sequence merely for gaining a model key', () => {
      // `m` is never emitted to the ICS, so back-filling it must not make every client re-fetch.
      const existing = eventItem('a', day(1));
      const result = replaceCalendarEventItemsForModelKey([existing], { modelKey: JOB_KEY, items: [existing], now: addDays(NOW, 10) });

      expect(result[0].q).toBeUndefined();
      expect(result[0].uat).toEqual(NOW);
    });

    it('should bump the sequence when an observable field changed', () => {
      const existing = eventItem('a', day(1), { m: JOB_KEY });
      const result = replaceCalendarEventItemsForModelKey([existing], { modelKey: JOB_KEY, items: [{ ...existing, n: 'Renamed' }], now: NOW });

      expect(result[0].n).toBe('Renamed');
      expect(result[0].q).toBe(1);
    });
  });

  describe('updateCalendarEventsTemplate() with replaceForModelKey', () => {
    it('should replace both arrays and still flag the calendar for sync', () => {
      const calendar = {
        e: [eventItem('old', day(1), { m: JOB_KEY }), eventItem('keep', day(2), { m: OTHER_KEY })],
        r: [recurringEventItem('oldR', day(1), { m: JOB_KEY })]
      };

      const template = updateCalendarEventsTemplate({
        calendar,
        replaceForModelKey: { modelKey: JOB_KEY, events: [eventItem('new', day(3))], recurringEvents: [recurringEventItem('newR', day(3))] },
        hardRemove: true,
        now: NOW
      });

      expect(template.s).toBe(true);
      expect(template.uat).toEqual(NOW);
      expect(template.e.map((x) => x.id).sort()).toEqual(['keep', 'new']);
      expect(template.r.map((x) => x.id)).toEqual(['newR']);
    });

    it('should remove every event for the key when the replacement set is empty', () => {
      const calendar = { e: [eventItem('old', day(1), { m: JOB_KEY })], r: [] };

      const template = updateCalendarEventsTemplate({
        calendar,
        replaceForModelKey: { modelKey: JOB_KEY },
        hardRemove: true,
        now: NOW
      });

      expect(template.e).toEqual([]);
    });
  });
});
