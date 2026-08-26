import { MS_IN_DAY } from '@dereekb/util';
import { iCalendarRecurrenceForRRuleLines } from '@dereekb/date';
import { type Calendar, type CalendarRecurringEventItem } from './calendar';
import { calendarToIcsString, calendarTypeConfigIcsConfig, calendarTypeConfigIcsExpansionRange } from './calendar.ics';
import { calendarIcsFileStoragePath } from './calendar.processing';
import { type CalendarTypeConfig } from './calendar.type';

/**
 * CAPTURED PRODUCTION DATA.
 *
 * Copied verbatim out of the `dereekb-components` dev project on 2026-08-26, off the profile calendar whose
 * ICS StorageFile sat in PROCESSING for a day: every run of the `cal_ics` subtask threw
 * `RangeError: Invalid time value` out of `iCalendarUtcDateTimeString()`, reached through the RDATE branch
 * of `iCalendarEventToComponent()` (confirmed by matching the deployed stack's line/column against the
 * built bundle).
 *
 * IT DOES NOT REPRODUCE HERE, and that is the point of keeping it. Rendering this exact calendar succeeds,
 * and the stored rule provably cannot reach the RDATE branch: `rr` is a single RRULE line and `rex` is
 * absent, so the parsed recurrence carries neither additionalDates nor exceptionDates. Whatever the server
 * actually held differed from what the model read returns.
 *
 * So these tests pin the two facts that make that gap visible if it ever closes: the calendar renders, and
 * its recurrence parses to an empty RDATE set. A change that starts emitting an RDATE for this input is the
 * change that explains the outage.
 */

/** The `demo_profile` config as registered by DEMO_CALENDAR_TYPE_CONFIGS. */
const DEMO_PROFILE_CONFIG: CalendarTypeConfig = {
  calendarType: 'demo_profile',
  name: 'Profile Calendar',
  retainPastEventDays: 30,
  maxEvents: 100,
  refreshInterval: 60,
  resyncInterval: MS_IN_DAY
};

/** Captured from `sf/cDoQAQSM9OyBnZi23duw`. */
const CAPTURED_STORAGE_FILE = {
  id: 'cDoQAQSM9OyBnZi23duw',
  bucketId: 'dereekb-components.appspot.com',
  pathString: '/cal/cDoQAQSM9OyBnZi23duw.ics',
  purpose: 'cal_ics',
  ownerKey: 'pr/xmKMcm9hnMSLAJtiIVuRhgdc8IYm',
  data: { cal: 'pr_xmKMcm9hnMSLAJtiIVuRhgdc8IYm' }
} as const;

const CAPTURED_CALENDAR_ID = 'pr_xmKMcm9hnMSLAJtiIVuRhgdc8IYm';

function ev(id: string, sa: string, at: string) {
  return { id, sa: new Date(sa), dur: 60, n: `Test Event ${id}`, cat: new Date(at), uat: new Date(at) };
}

/** The single recurring item — `rfe: true` alongside a terminating `COUNT=8`, exactly as stored. */
const CAPTURED_RECURRING_EVENT = {
  id: 'e1787686323552',
  sa: new Date('2026-08-10T14:00:00.000Z'),
  dur: 60,
  n: 'My Test Event',
  cat: new Date('2026-08-25T19:32:04.000Z'),
  uat: new Date('2026-08-25T19:32:04.000Z'),
  rr: 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=8',
  rfe: true
} as unknown as CalendarRecurringEventItem;

/** Captured from `cal/pr_xmKMcm9hnMSLAJtiIVuRhgdc8IYm`. */
const CAPTURED_CALENDAR = {
  t: 'demo_profile',
  n: 'Profile Calendar',
  tz: 'UTC',
  o: 'pr/xmKMcm9hnMSLAJtiIVuRhgdc8IYm',
  e: [
    ev('e1787690682294', '2026-07-28T19:00:00.000Z', '2026-08-25T20:44:43.000Z'),
    ev('e1787695600147', '2026-07-31T19:00:00.000Z', '2026-08-25T22:06:41.000Z'),
    ev('e1787766930884', '2026-08-04T20:00:00.000Z', '2026-08-26T17:55:31.000Z'),
    ev('e1787689848121', '2026-08-05T19:00:00.000Z', '2026-08-25T20:30:49.000Z'),
    ev('e1787690682928', '2026-08-06T19:00:00.000Z', '2026-08-25T20:44:43.000Z'),
    ev('e1787695597961', '2026-08-12T21:00:00.000Z', '2026-08-25T22:06:38.000Z'),
    ev('e1787695601945', '2026-08-13T21:00:00.000Z', '2026-08-25T22:06:42.000Z'),
    ev('e1787754722627', '2026-08-14T19:00:00.000Z', '2026-08-26T14:32:03.000Z'),
    ev('e1787706950153', '2026-08-19T15:00:00.000Z', '2026-08-26T01:15:51.000Z'),
    ev('e1787690681661', '2026-08-22T16:00:00.000Z', '2026-08-25T20:44:42.000Z'),
    ev('e1787686302160', '2026-08-23T14:00:00.000Z', '2026-08-25T19:31:43.000Z'),
    ev('e1787695599192', '2026-08-27T20:00:00.000Z', '2026-08-25T22:06:40.000Z'),
    ev('e1787746332299', '2026-08-28T22:00:00.000Z', '2026-08-26T12:12:13.000Z'),
    ev('e1787690582324', '2026-08-30T13:00:00.000Z', '2026-08-25T20:43:03.000Z'),
    ev('e1787706952899', '2026-08-31T17:00:00.000Z', '2026-08-26T01:15:53.000Z'),
    ev('e1787756785996', '2026-09-02T15:00:00.000Z', '2026-08-26T15:06:26.000Z'),
    ev('e1787695601047', '2026-09-05T19:00:00.000Z', '2026-08-25T22:06:42.000Z')
  ],
  r: [CAPTURED_RECURRING_EVENT],
  cat: new Date('2026-08-25T19:31:42.160Z'),
  uat: new Date('2026-08-26T17:55:30.884Z'),
  sat: new Date('2026-08-25T19:31:47.749Z'),
  isf: 'cDoQAQSM9OyBnZi23duw'
} as unknown as Calendar;

function renderCaptured(calendar: Calendar): string {
  return calendarToIcsString(calendar, {
    ...calendarTypeConfigIcsConfig(DEMO_PROFILE_CONFIG),
    calendarId: CAPTURED_CALENDAR_ID,
    domain: 'dereekb.com',
    expansionRange: calendarTypeConfigIcsExpansionRange(DEMO_PROFILE_CONFIG, new Date()),
    // the processor renders with the CONTENT's instant, not the wall clock
    now: calendar.uat
  });
}

describe('captured stuck profile calendar', () => {
  describe('the stored recurrence', () => {
    it('should parse to a rule with no RDATE and no EXDATE.', () => {
      const recurrence = iCalendarRecurrenceForRRuleLines(CAPTURED_RECURRING_EVENT.rr);

      expect(recurrence.rules).toEqual(['FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=8']);

      // the RDATE branch is where the deployed stack died; this input cannot reach it
      expect(recurrence.additionalDates ?? []).toEqual([]);
      expect(recurrence.exceptionDates ?? []).toEqual([]);
    });

    it('should carry rfe alongside a terminating COUNT.', () => {
      // createTestCalendarEvent() sets rfe unconditionally for any recurrenceRule, so a COUNT=8 rule is
      // stored as "recurs forever". Captured as-is: it is the contradictory state the dev row actually holds.
      expect(CAPTURED_RECURRING_EVENT.rfe).toBe(true);
      expect(CAPTURED_RECURRING_EVENT.rr).toContain('COUNT=8');
    });
  });

  describe('the ICS StorageFile', () => {
    it('should derive its object path from the StorageFile id.', () => {
      expect(calendarIcsFileStoragePath(CAPTURED_STORAGE_FILE.id)).toBe(CAPTURED_STORAGE_FILE.pathString);
    });

    it('should point back at the calendar it publishes.', () => {
      expect(CAPTURED_STORAGE_FILE.data.cal).toBe(CAPTURED_CALENDAR_ID);
      expect(CAPTURED_CALENDAR.isf).toBe(CAPTURED_STORAGE_FILE.id);
    });
  });

  describe('rendering', () => {
    it('should render the full captured calendar.', () => {
      const ics = renderCaptured(CAPTURED_CALENDAR);

      expect(ics).toContain('BEGIN:VCALENDAR');
      expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=8');
      expect(ics).toContain('My Test Event');
      expect(ics).toContain('END:VCALENDAR');

      // the property the deployed run threw on
      expect(ics).not.toContain('RDATE');
    });

    it('should render with only the recurring event.', () => {
      expect(renderCaptured({ ...CAPTURED_CALENDAR, e: [] } as unknown as Calendar)).toContain('My Test Event');
    });

    it('should render with only the one-off events.', () => {
      expect(renderCaptured({ ...CAPTURED_CALENDAR, r: [] } as unknown as Calendar)).toContain('BEGIN:VCALENDAR');
    });
  });
});
