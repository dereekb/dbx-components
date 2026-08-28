import { type Maybe, type TimezoneString } from '@dereekb/util';
import { baseDateToTargetDate } from '../date/date.timezone';
import { DateRRuleParseUtility, type RRuleExdateAttribute } from './date.rrule.parse';
import { wrapDateTests } from '../../test.spec';

describe('DateRRuleParseUtility', () => {
  /**
   * EXDATE with two of the same date defined.
   */
  const exdateLineA = 'EXDATE;TZID=America/Los_Angeles:20210611T110000,20210611T110000';
  const exdateLineADate = baseDateToTargetDate(new Date(Date.UTC(2021, 6 - 1, 11, 11, 0, 0)), 'America/Los_Angeles');

  /**
   * EXDATE with one UTC date defined.
   */
  const exdateLineB = 'EXDATE:20151225T173000Z';

  describe('separateRRuleStringSetValues()', () => {
    describe('DSTART', () => {
      describe('repeat yearly', () => {
        /**
         * Repeat yearly
         */
        const yearlyRepeatingRule = 'DTSTART;TZID=America/Los_Angeles:20210611T110000';

        const rruleStringLineSet = [yearlyRepeatingRule];

        it('should parse the date', () => {
          const results = DateRRuleParseUtility.separateRRuleStringSetValues(rruleStringLineSet);
          expect(results).toBeDefined();

          // todo
        });
      });
    });

    describe('rrule with EXDATE', () => {
      const rruleStringLineSet = ['RRULE:FREQ=WEEKLY', exdateLineA];

      it('should parse the EXDATE values', () => {
        const results = DateRRuleParseUtility.separateRRuleStringSetValues(rruleStringLineSet);

        const exdatesArray = [...results.exdates];

        expect(exdatesArray.length).toBe(1);
        expect(exdatesArray[0]).toBeSameSecondAs(exdateLineADate);
      });
    });

    describe('examples', () => {
      describe('mo,we,th at 11AM-12PM (1PM-2PM CST) 3 times', () => {
        function describeParseTestForTimezone(tzid: TimezoneString) {
          it('should parse the DTSTART and RRULE', () => {
            const rules = `DTSTART;TZID=${tzid}:20181101T190000\nRRULE:FREQ=WEEKLY;BYDAY=MO,WE,TH;INTERVAL=1;COUNT=3`;
            const rruleStringLineSet = [`DTSTART;TZID=${tzid}:20181101T190000`, 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,TH;INTERVAL=1;COUNT=3'];

            const result = DateRRuleParseUtility.separateRRuleStringSetValues(rruleStringLineSet);
            const lines = DateRRuleParseUtility.toRRuleLines(result.basic);

            expect(lines).toBe(rules);
          });
        }

        describeParseTestForTimezone(`America/Chicago`);
        describeParseTestForTimezone(`America/Los_Angeles`);
      });
    });
  });

  describe('EXDATE handling', () => {
    describe('parseExdateAttributeFromLine()', () => {
      function describeLineTests(line: string, { hasTimezone = false, testValue = undefined as Maybe<(result: RRuleExdateAttribute) => void> }) {
        it('should parse the exdate', () => {
          const result = DateRRuleParseUtility.parseExdateAttributeFromLine(line);
          expect(result.dates).toBeDefined();
          expect(result.dates.length).toBeGreaterThanOrEqual(1);
          expect(Boolean(result.timezone)).toBe(hasTimezone);
        });

        if (testValue) {
          it('should pass test value test', () => {
            const result = DateRRuleParseUtility.parseExdateAttributeFromLine(line);
            testValue(result);
          });
        }
      }

      describe('exdateLineA', () => {
        describeLineTests(exdateLineA, {
          hasTimezone: true,
          testValue: (result) => {
            expect(result.dates[0]).toBeSameSecondAs(exdateLineADate);
            expect(result.dates.length).toBe(2);
          }
        });
      });

      describe('exdateLineB', () => {
        describeLineTests(exdateLineB, { hasTimezone: false });
      });
    });

    describe('parseProperty', () => {
      it('should parse an exdate property.', () => {
        const property = DateRRuleParseUtility.parseProperty(exdateLineA);
        expect(property).toBeDefined();
        expect(property.type).toBe('EXDATE');
        expect(property.params.length).toBe(1);
        expect(property.params[0].key).toBe('TZID');
        expect(property.params[0].value).toBe('America/Los_Angeles');
        expect(property.values).toBeDefined();
        expect(property.values).toBe('20210611T110000,20210611T110000');
      });
    });

    describe('parseDateTimeString', () => {
      it('should parse a local date when a timezone is provided.', () => {
        const date = DateRRuleParseUtility.parseDateTimeStringWithTimezone('20210611T110000', 'America/Los_Angeles');
        expect(date).toBeSameSecondAs(exdateLineADate);
      });
    });

    describe('toRRuleStringSet()', () => {
      const rruleStringLineSet = ['RRULE:FREQ=WEEKLY', exdateLineA];

      it('should split rules lines', () => {
        const linesString = DateRRuleParseUtility.toRRuleLines(rruleStringLineSet);
        const stringSet = DateRRuleParseUtility.toRRuleStringSet(linesString);

        expect(stringSet.length).toBe(2);
        expect(stringSet[0]).toBe(rruleStringLineSet[0]);
        expect(stringSet[1]).toBe(rruleStringLineSet[1]);
      });
    });
  });
});

wrapDateTests(() => {
  describe('DateRRuleParseUtility.formatDateTimeString()', () => {
    it('should format a date as an RFC 5545 UTC date-time string.', () => {
      expect(DateRRuleParseUtility.formatDateTimeString(new Date('2021-06-11T11:00:00Z'))).toBe('20210611T110000Z');
    });

    it('should format the UTC wall clock, not the system timezone wall clock.', () => {
      // this value only renders as "20210611T110000Z" when the formatter targets UTC explicitly
      expect(DateRRuleParseUtility.formatDateTimeString(new Date(Date.UTC(2021, 6 - 1, 11, 11, 0, 0)))).toBe('20210611T110000Z');
    });

    it('should format a date that falls on a different calendar day in most system timezones.', () => {
      expect(DateRRuleParseUtility.formatDateTimeString(new Date('2021-01-01T00:00:00Z'))).toBe('20210101T000000Z');
      expect(DateRRuleParseUtility.formatDateTimeString(new Date('2021-12-31T23:59:59Z'))).toBe('20211231T235959Z');
    });

    it('should round-trip through parseDateTimeString().', () => {
      const date = new Date('2021-06-11T11:00:00Z');
      const formatted = DateRRuleParseUtility.formatDateTimeString(date);
      const parsed = DateRRuleParseUtility.parseDateTimeString(formatted, undefined);

      expect(parsed).toBeSameSecondAs(date);
    });
  });
});
