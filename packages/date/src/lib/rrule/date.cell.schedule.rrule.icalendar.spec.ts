import { type TimezoneString } from '@dereekb/util';
import { wrapDateTests } from '../../test.spec';
import { type DateCellSchedule, type FullDateCellScheduleRange, dateCellTiming, dateTimezoneUtcNormal } from '../date';
import { iCalendarEventToComponent } from '../icalendar/icalendar.component';
import { type ICalendarDateTimeValue, type ICalendarEvent } from '../icalendar/icalendar.model';
import { iCalendarRecurrenceForRRuleLines } from '../icalendar/icalendar.recurrence';
import { type DateCellScheduleRangeRecurrenceRRule, dateCellScheduleRangeRRule } from './date.cell.schedule.rrule';

/**
 * THE SEAM THIS FILE COVERS.
 *
 * `dateCellScheduleRangeRRule()` is the only producer of a stored `rr`, and what it produces is not just an
 * RRULE: it emits EXDATE and RDATE lines alongside it, comma-joined, via `RRule.optionsToString()` plus its
 * own `dateListPropertyLine()`. Publishing reads that blob back through `iCalendarRecurrenceForRRuleLines()`,
 * whose EXDATE/RDATE sets become the ONE path in `iCalendarEventToComponent()` that reaches
 * `iCalendarDateTimeContentLine()` through a forEach.
 *
 * Generation and expansion were each tested in isolation; the hand-off between them was not. A date that
 * survives generation but parses back as an unrepresentable instant produces a bare
 * "RangeError: Invalid time value" from deep inside date-fns at publish time — which is precisely how a
 * calendar gets stuck retrying forever with nothing to show for it.
 */

interface ScheduleRangeTestConfig {
  readonly timezone: TimezoneString;
  readonly schedule: DateCellSchedule;
  readonly days: number;
}

function scheduleRange(config: ScheduleRangeTestConfig): FullDateCellScheduleRange {
  const { timezone, schedule, days } = config;
  const startsAt = dateTimezoneUtcNormal(timezone).targetDateToBaseDate(new Date(Date.UTC(2026, 2, 2, 11, 0, 0, 0)));
  const timing = dateCellTiming({ startsAt, duration: 60 }, days, timezone);
  return { ...timing, ...schedule };
}

function isValidDateTimeValue(value: ICalendarDateTimeValue): boolean {
  return value.type === 'date' ? true : !Number.isNaN(value.at.getTime());
}

const ROUND_TRIP_TIMEZONES: TimezoneString[] = ['UTC', 'America/Denver', 'America/Chicago', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Kiritimati'];

/**
 * Deliberately weighted toward the shapes that force an EXDATE or an RDATE into the stored rule, since a
 * plain weekly pattern emits neither and never reaches the failing path.
 */
const CASES: { readonly name: string; readonly schedule: DateCellSchedule; readonly days: number }[] = [
  { name: 'weekdays only', schedule: { w: '8' }, days: 19 },
  { name: 'every day', schedule: { w: '89' }, days: 19 },
  { name: 'an interior exclusion', schedule: { w: '8', ex: [3] }, days: 19 },
  { name: 'multiple exclusions', schedule: { w: '8', ex: [3, 4, 10] }, days: 19 },
  { name: 'an included day outside the pattern', schedule: { w: '8', d: [5] }, days: 19 },
  { name: 'included and excluded days together', schedule: { w: '8', d: [5], ex: [3] }, days: 19 },
  { name: 'no weekly pattern and only included days', schedule: { w: '', d: [0, 3, 9] }, days: 19 },
  { name: 'a single day range', schedule: { w: '89' }, days: 1 }
];

wrapDateTests(() => {
  describe('dateCellScheduleRangeRRule() -> iCalendar', () => {
    ROUND_TRIP_TIMEZONES.forEach((timezone) => {
      describe(`in ${timezone}`, () => {
        CASES.forEach(({ name, schedule, days }) => {
          describe(`with ${name}`, () => {
            function generated(): DateCellScheduleRangeRecurrenceRRule {
              const result = dateCellScheduleRangeRRule({ range: scheduleRange({ timezone, schedule, days }) });
              expect(result.recurs).toBe(true);
              return result as DateCellScheduleRangeRecurrenceRRule;
            }

            it('should parse every emitted EXDATE and RDATE back into a representable instant.', () => {
              const result = generated();
              const recurrence = iCalendarRecurrenceForRRuleLines(result.rrule);

              [...(recurrence.exceptionDates ?? []), ...(recurrence.additionalDates ?? [])].forEach((value) => {
                expect(isValidDateTimeValue(value)).toBe(true);
              });
            });

            it('should preserve the emitted EXDATE and RDATE counts through the parser.', () => {
              const result = generated();
              const recurrence = iCalendarRecurrenceForRRuleLines(result.rrule);

              expect(recurrence.exceptionDates?.length ?? 0).toBe(result.exdates.length);
              expect(recurrence.additionalDates?.length ?? 0).toBe(result.rdates.length);
            });

            it('should serialize a VEVENT built from the generated rule.', () => {
              const result = generated();

              const event: ICalendarEvent = {
                uid: `${name.replaceAll(/\s/g, '-')}@dereekb.com`,
                summary: 'Generated',
                start: { type: 'utc', at: result.start },
                duration: result.duration,
                recurrence: iCalendarRecurrenceForRRuleLines(result.rrule)
              };

              // the publish-time call that throws a bare RangeError when a parsed EXDATE/RDATE is unrepresentable
              const component = iCalendarEventToComponent(event, result.start);

              expect(component.name).toBe('VEVENT');

              // Note the asymmetry: the generator emits ONE comma-joined EXDATE/RDATE line per property,
              // while the serializer emits one line PER DATE. Both are valid RFC 5545 — the property is
              // defined as a date list and may repeat — so this asserts the dates all survive, not that the
              // line count round-trips.
              expect(component.lines.filter((x) => x.name === 'EXDATE').length).toBe(result.exdates.length);
              expect(component.lines.filter((x) => x.name === 'RDATE').length).toBe(result.rdates.length);
            });
          });
        });
      });
    });
  });
});
