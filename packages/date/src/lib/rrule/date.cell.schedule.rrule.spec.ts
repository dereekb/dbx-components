import { addDays, addMinutes } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { type TimezoneString } from '@dereekb/util';
import { wrapDateTests } from '../../test.spec';
import { type DateCellSchedule, type FullDateCellScheduleRange, dateCellTiming, dateTimezoneUtcNormal, expandDateCellScheduleRange } from '../date';
import { DateRRuleUtility } from './date.rrule';
import { DateRRuleParseUtility } from './date.rrule.parse';
import { RRule } from './rrule.interop';
import { type DateCellScheduleRangeRecurrenceRRule, dateCellScheduleRangeModelRecurrenceInfo, dateCellScheduleRangeRRule } from './date.cell.schedule.rrule';

/**
 * Input for {@link scheduleRange}. The date parts describe a WALL CLOCK in `timezone`, which is then resolved
 * to the real instant the schedule actually starts at.
 */
interface ScheduleRangeTestConfig {
  readonly timezone: TimezoneString;
  readonly schedule: DateCellSchedule;
  readonly days: number;
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hours: number;
  readonly minutes?: number;
  readonly seconds?: number;
  readonly ms?: number;
  readonly duration?: number;
}

/**
 * Builds a FullDateCellScheduleRange spanning `days` days starting at the given wall clock.
 */
function scheduleRange(config: ScheduleRangeTestConfig): FullDateCellScheduleRange {
  const { timezone, schedule, days, year, month, day, hours, minutes = 0, seconds = 0, ms = 0, duration = 60 } = config;
  const startsAt = dateTimezoneUtcNormal(timezone).targetDateToBaseDate(new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds, ms)));
  const timing = dateCellTiming({ startsAt, duration }, days, timezone);
  return { ...timing, ...schedule };
}

/**
 * The ground truth: the occurrence instants the existing expansion produces.
 */
function groundTruth(range: FullDateCellScheduleRange): string[] {
  return expandDateCellScheduleRange({ dateCellScheduleRange: range }).map((x) => x.startsAt.toISOString());
}

/**
 * Expands the generated rule back out through the normal recurrence path.
 *
 * No range is passed: every generated rule carries a COUNT, so it is never forever, and `all()` avoids the
 * range-conversion path entirely.
 */
function expandGenerated(result: DateCellScheduleRangeRecurrenceRRule): string[] {
  const expansion = DateRRuleUtility.expand({
    instanceFrom: {
      rruleLines: result.rrule,
      options: {
        date: { startsAt: result.start, duration: result.duration },
        timezone: result.timezone
      }
    }
  });

  return expansion.dates.map((x) => x.startsAt.toISOString());
}

/**
 * Builds a DateRRuleInstance from a generated result, for the methods that bypass expand().
 */
function instanceFor(result: DateCellScheduleRangeRecurrenceRRule) {
  return DateRRuleUtility.makeInstance({
    rruleLines: result.rrule,
    options: {
      date: { startsAt: result.start, duration: result.duration },
      timezone: result.timezone
    }
  });
}

const ROUND_TRIP_TIMEZONES: TimezoneString[] = ['UTC', 'America/Denver', 'America/Chicago', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Kiritimati'];

wrapDateTests(() => {
  describe('dateCellScheduleRangeRRule()', () => {
    describe('round trip equivalence', () => {
      const cases: { readonly name: string; readonly schedule: DateCellSchedule; readonly days: number }[] = [
        { name: 'weekdays only', schedule: { w: '8' }, days: 19 },
        { name: 'weekends only', schedule: { w: '9' }, days: 19 },
        { name: 'every day', schedule: { w: '89' }, days: 19 },
        { name: 'a single weekday', schedule: { w: '4' }, days: 19 },
        { name: 'a single day range', schedule: { w: '89' }, days: 1 },
        { name: 'with an interior exclusion', schedule: { w: '8', ex: [3] }, days: 19 },
        { name: 'with a leading exclusion', schedule: { w: '89', ex: [0] }, days: 19 },
        { name: 'with a trailing exclusion', schedule: { w: '89', ex: [18] }, days: 19 },
        { name: 'with multiple exclusions', schedule: { w: '8', ex: [3, 4, 10] }, days: 19 },
        { name: 'with an included day outside the pattern', schedule: { w: '8', d: [5] }, days: 19 },
        { name: 'with an included day already in the pattern', schedule: { w: '8', d: [3] }, days: 19 },
        { name: 'with an included and excluded day overlapping', schedule: { w: '8', d: [3], ex: [3] }, days: 19 },
        { name: 'with no weekly pattern and only included days', schedule: { w: '', d: [0, 3, 9] }, days: 19 }
      ];

      ROUND_TRIP_TIMEZONES.forEach((timezone) => {
        describe(`in ${timezone}`, () => {
          cases.forEach(({ name, schedule, days }) => {
            it(`should reproduce the expansion for ${name}.`, () => {
              const range = scheduleRange({ timezone, schedule, days, year: 2026, month: 3, day: 2, hours: 11 });
              const expected = groundTruth(range);
              const result = dateCellScheduleRangeRRule({ range });

              expect(result.occurrences.map((x) => x.toISOString())).toEqual(expected);

              if (expected.length) {
                expect(result.recurs).toBe(true);
                expect(expandGenerated(result as DateCellScheduleRangeRecurrenceRRule)).toEqual(expected);
              } else {
                expect(result.recurs).toBe(false);
              }
            });
          });
        });
      });
    });

    describe('positive control', () => {
      // Pins concrete counts so the round-trip matrix above cannot pass vacuously on empty arrays.
      // 2026-03-02 is a Monday, so a 19 day range is 2026-03-02..2026-03-20.
      const expectations: { readonly schedule: DateCellSchedule; readonly count: number }[] = [
        { schedule: { w: '8' }, count: 15 },
        { schedule: { w: '9' }, count: 4 },
        { schedule: { w: '89' }, count: 19 },
        { schedule: { w: '8', ex: [3] }, count: 14 },
        { schedule: { w: '8', d: [5] }, count: 16 },
        { schedule: { w: '8', d: [3], ex: [3] }, count: 14 },
        { schedule: { w: '', d: [0, 3, 9] }, count: 3 }
      ];

      expectations.forEach(({ schedule, count }) => {
        it(`should produce ${count} occurrences for ${JSON.stringify(schedule)}.`, () => {
          const range = scheduleRange({ timezone: 'Asia/Tokyo', schedule, days: 19, year: 2026, month: 3, day: 2, hours: 13 });
          const result = dateCellScheduleRangeRRule({ range });

          expect(groundTruth(range).length).toBe(count);
          expect(result.occurrences.length).toBe(count);
          expect(expandGenerated(result as DateCellScheduleRangeRecurrenceRRule).length).toBe(count);
        });
      });
    });

    describe('anchor', () => {
      it('should anchor on the first actual occurrence rather than the range startsAt.', () => {
        // 2026-06-13 is a Saturday, but only weekdays are enabled.
        const range = scheduleRange({ timezone: 'America/Chicago', schedule: { w: '8' }, days: 8, year: 2026, month: 6, day: 13, hours: 11 });
        const result = dateCellScheduleRangeRRule({ range }) as DateCellScheduleRangeRecurrenceRRule;

        expect(result.recurs).toBe(true);
        expect(result.start.toISOString()).not.toBe(range.startsAt.toISOString());
        // the following Monday
        expect(formatInTimeZone(result.start, 'America/Chicago', 'yyyy-MM-dd')).toBe('2026-06-15');
        expect(result.anchorOffPattern).toBe(false);
      });

      it('should flag an anchor that the emitted pattern does not produce.', () => {
        // Mondays only, but index 0 is a Sunday that `d` forces in ahead of the first Monday.
        const range = scheduleRange({ timezone: 'UTC', schedule: { w: '2', d: [0] }, days: 15, year: 2026, month: 3, day: 1, hours: 11 });
        const result = dateCellScheduleRangeRRule({ range }) as DateCellScheduleRangeRecurrenceRRule;

        expect(result.anchorOffPattern).toBe(true);
        // the skipped anchor must be re-added by RDATE, or it would be lost entirely
        expect(result.rdates.map((x) => x.toISOString())).toContain(result.start.toISOString());
        expect(expandGenerated(result)).toEqual(groundTruth(range));
      });
    });

    describe('COUNT rather than UNTIL', () => {
      // An UNTIL emitted as a real instant drops the final occurrence in every east-of-UTC zone, because the
      // expansion compares it in wall space. COUNT is space-invariant.
      (['Asia/Tokyo', 'Australia/Sydney', 'Pacific/Kiritimati', 'Europe/London', 'America/Chicago'] as TimezoneString[]).forEach((timezone) => {
        it(`should keep every occurrence in ${timezone}.`, () => {
          const range = scheduleRange({ timezone, schedule: { w: '8' }, days: 19, year: 2026, month: 3, day: 2, hours: 13 });
          const result = dateCellScheduleRangeRRule({ range }) as DateCellScheduleRangeRecurrenceRRule;

          expect(result.rrule).not.toContain('UNTIL');
          expect(result.rrule).toContain('COUNT=');
          expect(expandGenerated(result)).toEqual(groundTruth(range));
        });
      });

      it('should trim trailing exclusions out of COUNT rather than emitting an EXDATE for them.', () => {
        // Mon-Fri over 5 days, with the final Friday excluded.
        const range = scheduleRange({ timezone: 'UTC', schedule: { w: '8', ex: [4] }, days: 5, year: 2026, month: 3, day: 2, hours: 11 });
        const result = dateCellScheduleRangeRRule({ range }) as DateCellScheduleRangeRecurrenceRRule;

        expect(result.count).toBe(4);
        expect(result.exdates).toEqual([]);
        expect(result.rrule).not.toContain('EXDATE');
        // `end` must be the last REAL occurrence's end, not the range end
        expect(result.end.toISOString()).toBe(addMinutes(result.occurrences[result.occurrences.length - 1], 60).toISOString());
      });

      it('should not emit an EXDATE for a leading exclusion, since it falls below the anchor.', () => {
        const range = scheduleRange({ timezone: 'UTC', schedule: { w: '89', ex: [0] }, days: 5, year: 2026, month: 3, day: 2, hours: 11 });
        const result = dateCellScheduleRangeRRule({ range }) as DateCellScheduleRangeRecurrenceRRule;

        expect(result.exdates).toEqual([]);
        expect(expandGenerated(result)).toEqual(groundTruth(range));
      });

      it('should emit an EXDATE for an interior exclusion.', () => {
        const range = scheduleRange({ timezone: 'UTC', schedule: { w: '89', ex: [2] }, days: 5, year: 2026, month: 3, day: 2, hours: 11 });
        const result = dateCellScheduleRangeRRule({ range }) as DateCellScheduleRangeRecurrenceRRule;

        expect(result.exdates.length).toBe(1);
        expect(result.rrule).toContain('EXDATE:');
        expect(expandGenerated(result)).toEqual(groundTruth(range));
      });
    });

    describe('daylight savings', () => {
      it('should hold the local wall clock across a spring-forward transition.', () => {
        // America/Chicago springs forward 2026-03-08.
        const range = scheduleRange({ timezone: 'America/Chicago', schedule: { w: '8' }, days: 19, year: 2026, month: 3, day: 2, hours: 11 });
        const result = dateCellScheduleRangeRRule({ range }) as DateCellScheduleRangeRecurrenceRRule;

        expect(expandGenerated(result)).toEqual(groundTruth(range));
        result.occurrences.forEach((x) => {
          expect(formatInTimeZone(x, 'America/Chicago', 'HH:mm')).toBe('11:00');
        });
      });

      it('should hold the local wall clock across a fall-back transition.', () => {
        // America/Chicago falls back 2026-11-01.
        const range = scheduleRange({ timezone: 'America/Chicago', schedule: { w: '89' }, days: 8, year: 2026, month: 10, day: 29, hours: 11 });
        const result = dateCellScheduleRangeRRule({ range }) as DateCellScheduleRangeRecurrenceRRule;

        expect(expandGenerated(result)).toEqual(groundTruth(range));
        result.occurrences.forEach((x) => {
          expect(formatInTimeZone(x, 'America/Chicago', 'HH:mm')).toBe('11:00');
        });
      });

      it('should reproduce the expansion even when the wall clock does not exist on the transition day.', () => {
        // 02:30 does not exist in America/Chicago on 2026-03-08. Both pipelines must produce the SAME anomaly.
        const range = scheduleRange({ timezone: 'America/Chicago', schedule: { w: '89' }, days: 5, year: 2026, month: 3, day: 6, hours: 2, minutes: 30 });
        const result = dateCellScheduleRangeRRule({ range }) as DateCellScheduleRangeRecurrenceRRule;

        expect(expandGenerated(result)).toEqual(groundTruth(range));
      });

      it('should reproduce the expansion when the wall clock is ambiguous on the transition day.', () => {
        // 01:30 happens twice in America/Chicago on 2026-11-01.
        const range = scheduleRange({ timezone: 'America/Chicago', schedule: { w: '89' }, days: 5, year: 2026, month: 10, day: 30, hours: 1, minutes: 30 });
        const result = dateCellScheduleRangeRRule({ range }) as DateCellScheduleRangeRecurrenceRRule;

        expect(expandGenerated(result)).toEqual(groundTruth(range));
      });
    });

    describe('frequency form', () => {
      it('should emit FREQ=DAILY when every day is enabled.', () => {
        const range = scheduleRange({ timezone: 'America/Chicago', schedule: { w: '89' }, days: 19, year: 2026, month: 3, day: 2, hours: 11 });
        const result = dateCellScheduleRangeRRule({ range }) as DateCellScheduleRangeRecurrenceRRule;

        expect(result.rrule).toContain('FREQ=DAILY');
        expect(result.rrule).not.toContain('BYDAY');
      });

      it('should produce identical occurrences with either frequency form.', () => {
        const range = scheduleRange({ timezone: 'Australia/Sydney', schedule: { w: '89' }, days: 40, year: 2026, month: 3, day: 2, hours: 9 });
        const daily = dateCellScheduleRangeRRule({ range, preferDailyFrequency: true }) as DateCellScheduleRangeRecurrenceRRule;
        const weekly = dateCellScheduleRangeRRule({ range, preferDailyFrequency: false }) as DateCellScheduleRangeRecurrenceRRule;

        expect(daily.rrule).not.toBe(weekly.rrule);
        expect(weekly.rrule).toContain('BYDAY=SU,MO,TU,WE,TH,FR,SA');
        expect(expandGenerated(weekly)).toEqual(expandGenerated(daily));
        expect(expandGenerated(weekly)).toEqual(groundTruth(range));
      });

      it('should emit BYDAY tokens Sunday-first so output is byte-stable.', () => {
        const range = scheduleRange({ timezone: 'UTC', schedule: { w: '8' }, days: 19, year: 2026, month: 3, day: 2, hours: 11 });
        const result = dateCellScheduleRangeRRule({ range }) as DateCellScheduleRangeRecurrenceRRule;

        expect(result.rrule).toContain('BYDAY=MO,TU,WE,TH,FR');
      });
    });

    describe('included and excluded day precedence', () => {
      it('should let ex beat d when an index appears in both.', () => {
        // index 3 is a Wednesday: `w` does not include it, `d` adds it, `ex` removes it again.
        const range = scheduleRange({ timezone: 'UTC', schedule: { w: '2', d: [3], ex: [3] }, days: 15, year: 2026, month: 3, day: 2, hours: 11 });
        const result = dateCellScheduleRangeRRule({ range }) as DateCellScheduleRangeRecurrenceRRule;

        const excludedInstant = addDays(range.startsAt, 3).toISOString();
        expect(result.occurrences.map((x) => x.toISOString())).not.toContain(excludedInstant);
        expect(result.rdates.map((x) => x.toISOString())).not.toContain(excludedInstant);
        expect(result.exdates.map((x) => x.toISOString())).not.toContain(excludedInstant);
        expect(expandGenerated(result)).toEqual(groundTruth(range));
      });

      it('should emit an RDATE for an included day outside the weekly pattern.', () => {
        // Mondays only; index 3 is a Thursday.
        const range = scheduleRange({ timezone: 'UTC', schedule: { w: '2', d: [3] }, days: 15, year: 2026, month: 3, day: 2, hours: 11 });
        const result = dateCellScheduleRangeRRule({ range }) as DateCellScheduleRangeRecurrenceRRule;

        expect(result.rdates.length).toBe(1);
        expect(result.rrule).toContain('RDATE:');
        expect(expandGenerated(result)).toEqual(groundTruth(range));
      });

      it('should drop an included day beyond the range, matching the expansion.', () => {
        const range = scheduleRange({ timezone: 'UTC', schedule: { w: '8', d: [100] }, days: 10, year: 2026, month: 3, day: 2, hours: 11 });
        const result = dateCellScheduleRangeRRule({ range }) as DateCellScheduleRangeRecurrenceRRule;

        expect(result.rdates).toEqual([]);
        expect(result.rrule).not.toContain('RDATE');
        expect(expandGenerated(result)).toEqual(groundTruth(range));
      });
    });

    describe('degenerate input', () => {
      it('should emit a one-occurrence rule plus RDATEs when there is no weekly pattern.', () => {
        const range = scheduleRange({ timezone: 'UTC', schedule: { w: '', d: [0, 3, 9] }, days: 15, year: 2026, month: 3, day: 2, hours: 11 });
        const result = dateCellScheduleRangeRRule({ range }) as DateCellScheduleRangeRecurrenceRRule;

        expect(result.recurs).toBe(true);
        expect(result.rrule).toContain('FREQ=DAILY');
        expect(result.rrule).toContain('COUNT=1');
        expect(result.rdates.length).toBe(2);
        expect(result.occurrences.length).toBe(3);
        expect(expandGenerated(result)).toEqual(groundTruth(range));
      });

      it('should report no recurrence when nothing is scheduled at all.', () => {
        const range = scheduleRange({ timezone: 'UTC', schedule: { w: '' }, days: 15, year: 2026, month: 3, day: 2, hours: 11 });
        const result = dateCellScheduleRangeRRule({ range });

        expect(result.recurs).toBe(false);
        // NOT an empty string: an empty rule parses to {} and rrule defaults FREQ to YEARLY
        expect(result.rrule).toBeUndefined();
        expect(result.occurrences).toEqual([]);
        expect(dateCellScheduleRangeModelRecurrenceInfo(result)).toBeUndefined();
      });

      it('should report no recurrence when every pattern day is excluded.', () => {
        const range = scheduleRange({ timezone: 'UTC', schedule: { w: '89', ex: [0, 1, 2] }, days: 3, year: 2026, month: 3, day: 2, hours: 11 });
        const result = dateCellScheduleRangeRRule({ range });

        expect(result.recurs).toBe(false);
        expect(result.rrule).toBeUndefined();
      });

      it('should handle a single occurrence as an ordinary bounded recurrence.', () => {
        const range = scheduleRange({ timezone: 'UTC', schedule: { w: '89' }, days: 1, year: 2026, month: 3, day: 4, hours: 11 });
        const result = dateCellScheduleRangeRRule({ range }) as DateCellScheduleRangeRecurrenceRRule;

        expect(result.count).toBe(1);
        expect(result.forever).toBe(false);
        expect(result.start.toISOString()).toBe(range.startsAt.toISOString());
        expect(result.end.toISOString()).toBe(addMinutes(range.startsAt, 60).toISOString());
      });

      it('should truncate a sub-second startsAt so the emitted values can round trip.', () => {
        const range = scheduleRange({ timezone: 'UTC', schedule: { w: '89', ex: [1] }, days: 4, year: 2026, month: 3, day: 2, hours: 11, seconds: 30, ms: 500 });
        const result = dateCellScheduleRangeRRule({ range }) as DateCellScheduleRangeRecurrenceRRule;

        expect(result.start.getMilliseconds()).toBe(0);
        // the exclusion only takes effect because the anchor was truncated to the second
        expect(expandGenerated(result)).toEqual(result.occurrences.map((x) => x.toISOString()));
      });
    });

    describe('emitted rule invariants', () => {
      const invariantCases: DateCellSchedule[] = [{ w: '8' }, { w: '89' }, { w: '9', ex: [1] }, { w: '2', d: [3] }, { w: '', d: [0, 5] }, { w: '8', d: [6], ex: [3] }];

      invariantCases.forEach((schedule, index) => {
        it(`should emit exactly one RRULE line and no DTSTART for case ${index}.`, () => {
          const range = scheduleRange({ timezone: 'America/Denver', schedule, days: 15, year: 2026, month: 3, day: 2, hours: 11 });
          const result = dateCellScheduleRangeRRule({ range }) as DateCellScheduleRangeRecurrenceRRule;

          const separation = DateRRuleParseUtility.separateRRuleStringSetValues(DateRRuleParseUtility.toRRuleStringSet(result.rrule));
          expect(separation.basic.length).toBe(1);
          expect(result.rrule).not.toContain('DTSTART');

          const parsed = RRule.parseString(separation.basic[0]);
          expect(parsed.dtstart).toBeFalsy();
          expect(parsed.tzid).toBeFalsy();
          expect(parsed.freq).not.toBeUndefined();
        });
      });

      it('should be deterministic.', () => {
        const range = scheduleRange({ timezone: 'America/Denver', schedule: { w: '8', d: [6], ex: [3] }, days: 15, year: 2026, month: 3, day: 2, hours: 11 });
        const a = dateCellScheduleRangeRRule({ range });
        const b = dateCellScheduleRangeRRule({ range });

        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      });
    });

    describe('recurrence range derivation', () => {
      // These exercise getRecurrenceDateRange() / haveRecurrenceInDateRange(), which bypass expand() and used
      // the opposite conversion direction. Every pre-existing spec for them ran at offset 0, so the mismatch
      // was invisible; a generated rule is the first thing that actually round-trips through them.
      const timezone = 'America/Chicago';

      it('should report a start equal to the generated anchor.', () => {
        const range = scheduleRange({ timezone, schedule: { w: '8' }, days: 19, year: 2026, month: 3, day: 2, hours: 11 });
        const result = dateCellScheduleRangeRRule({ range }) as DateCellScheduleRangeRecurrenceRRule;

        expect(instanceFor(result).getRecurrenceDateRange().start.toISOString()).toBe(result.start.toISOString());
      });

      it('should report a finalRecurrenceEndsAt equal to the generated end.', () => {
        const range = scheduleRange({ timezone, schedule: { w: '8' }, days: 19, year: 2026, month: 3, day: 2, hours: 11 });
        const result = dateCellScheduleRangeRRule({ range }) as DateCellScheduleRangeRecurrenceRRule;

        expect(instanceFor(result).getRecurrenceDateRange().finalRecurrenceEndsAt?.toISOString()).toBe(result.end.toISOString());
      });

      it('should let an RDATE past the rule end move the reported end.', () => {
        // Mondays only, with a Saturday at the very end of the range forced in by `d`.
        const range = scheduleRange({ timezone, schedule: { w: '2', d: [12] }, days: 13, year: 2026, month: 3, day: 2, hours: 11 });
        const result = dateCellScheduleRangeRRule({ range }) as DateCellScheduleRangeRecurrenceRRule;

        expect(result.rdates.length).toBe(1);
        expect(instanceFor(result).getRecurrenceDateRange().finalRecurrenceEndsAt?.toISOString()).toBe(result.end.toISOString());
      });

      it('should find a recurrence inside a range expressed as real instants.', () => {
        const range = scheduleRange({ timezone, schedule: { w: '8' }, days: 19, year: 2026, month: 3, day: 2, hours: 11 });
        const result = dateCellScheduleRangeRRule({ range }) as DateCellScheduleRangeRecurrenceRRule;
        const instance = instanceFor(result);

        expect(instance.haveRecurrenceInDateRange({ start: result.start, end: result.end })).toBe(true);
        expect(instance.haveRecurrenceInDateRange({ start: addDays(result.end, 40), end: addDays(result.end, 80) })).toBe(false);
      });

      it('should return identical results when expanded twice with the same range object.', () => {
        const range = scheduleRange({ timezone, schedule: { w: '8' }, days: 19, year: 2026, month: 3, day: 2, hours: 11 });
        const result = dateCellScheduleRangeRRule({ range }) as DateCellScheduleRangeRecurrenceRRule;
        const instance = instanceFor(result);
        // deliberately the SAME object both times: expand() used to convert it in place
        const shared = { start: addDays(result.start, -1), end: addDays(result.end, 1) };

        const first = instance.expand({ range: shared }).dates.map((x) => x.startsAt.toISOString());
        const second = instance.expand({ range: shared }).dates.map((x) => x.startsAt.toISOString());

        expect(second).toEqual(first);
        expect(first.length).toBe(result.occurrences.length);
      });
    });

    describe('dateCellScheduleRangeModelRecurrenceInfo()', () => {
      it('should project every field off the result with no derivation.', () => {
        const range = scheduleRange({ timezone: 'America/Chicago', schedule: { w: '8' }, days: 19, year: 2026, month: 3, day: 2, hours: 11 });
        const result = dateCellScheduleRangeRRule({ range }) as DateCellScheduleRangeRecurrenceRRule;
        const info = dateCellScheduleRangeModelRecurrenceInfo(result);

        expect(info).not.toBeUndefined();
        expect(info?.timezone).toBe('America/Chicago');
        expect(info?.rrule).toBe(result.rrule);
        expect(info?.start.toISOString()).toBe(result.start.toISOString());
        expect(info?.end.toISOString()).toBe(result.end.toISOString());
        expect(info?.forever).toBe(false);
      });
    });
  });
});
