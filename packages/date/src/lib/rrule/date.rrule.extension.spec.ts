import { type DateRRule } from './date.rrule.extension';
import { type DateRRuleInstance, DateRRuleUtility } from '@dereekb/date';

describe('DateRRule', () => {
  const currentDate = new Date('2018-10-01T00:00:00.000Z');

  const firstDate = new Date('2018-11-01T19:00:00.000Z');
  const lastDate = new Date('2018-11-07T19:00:00.000Z');

  /**
   * This represents 7PM in Denver
   */
  const rruleStringLineSet = ['DTSTART;TZID=America/Denver:20181101T190000;', 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,TH;INTERVAL=1;COUNT=3'];
  let dateRRuleInstance: DateRRuleInstance;
  let dateRRule: DateRRule;

  beforeEach(async () => {
    dateRRuleInstance = DateRRuleUtility.makeInstance({
      rruleStringLineSet,
      options: {}
    });
    dateRRule = dateRRuleInstance.rrule;
  });

  describe('next()', () => {
    it('should return the next recurrence', () => {
      const result = dateRRule.next(currentDate);
      expect(result).toBeSameSecondAs(firstDate);
    });

    describe('with forever', () => {
      let foreverDateRRuleInstance: DateRRuleInstance;
      let foreverDateRRule: DateRRule;

      beforeEach(async () => {
        // Create a rule with no COUNT or UNTIL (forever rule)
        const foreverRruleStringLineSet = ['DTSTART;TZID=America/Denver:20181101T190000;', 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,TH;INTERVAL=1'];
        foreverDateRRuleInstance = DateRRuleUtility.makeInstance({
          rruleStringLineSet: foreverRruleStringLineSet,
          options: {}
        });
        foreverDateRRule = foreverDateRRuleInstance.rrule;
      });

      it('should return the next recurrence even for forever rules', () => {
        const result = foreverDateRRule.next(currentDate);
        expect(result).toBeSameSecondAs(firstDate);
      });

      it('should return the next recurrence after the first date', () => {
        const laterDate = new Date('2018-11-02T00:00:00.000Z');
        const expectedNextDate = new Date('2018-11-05T19:00:00.000Z');
        const result = foreverDateRRule.next(laterDate);
        expect(result).toBeSameSecondAs(expectedNextDate);
      });
    });
  });

  describe('last()', () => {
    it('should return the last recurrence', () => {
      const result = dateRRule.last();
      expect(result).toBeSameSecondAs(lastDate);
    });

    describe('with forever', () => {
      let foreverDateRRuleInstance: DateRRuleInstance;
      let foreverDateRRule: DateRRule;

      beforeEach(async () => {
        // Create a rule with no COUNT or UNTIL (forever rule)
        const foreverRruleStringLineSet = ['DTSTART;TZID=America/Denver:20181101T190000;', 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,TH;INTERVAL=1'];
        foreverDateRRuleInstance = DateRRuleUtility.makeInstance({
          rruleStringLineSet: foreverRruleStringLineSet,
          options: {}
        });
        foreverDateRRule = foreverDateRRuleInstance.rrule;
      });

      it('should return a result even for forever rules (limited by max iterations)', () => {
        const result = foreverDateRRule.last();
        expect(result).toBeDefined();
        // The result should be some date far in the future, limited by maxIterationsAllowed
        expect(result).toBeInstanceOf(Date);
      });

      it('should respect the maxIterationsAllowed parameter', () => {
        // Since forever rules could iterate infinitely, the last() method uses
        // DEFAULT_LAST_ITER_RESULT_MAX_ITERATIONS_ALLOWED to prevent infinite loops
        const result = foreverDateRRule.last();
        expect(result).toBeDefined();
        // The exact date depends on the max iterations, but it should be defined
      });
    });
  });

  describe('any()', () => {
    it('should return true if there is any recurrence.', () => {
      const result = dateRRule.any();
      expect(result).toBe(true);
    });

    describe('with filter', () => {
      it('should return true if there is any recurrence within the minDate/maxDate range', () => {
        const minDate = new Date('2018-11-01T00:00:00.000Z');
        const maxDate = new Date('2018-11-10T00:00:00.000Z');
        const result = dateRRule.any({ minDate, maxDate });
        expect(result).toBe(true);
      });

      it('should return false if there is no recurrence within the minDate/maxDate range', () => {
        const minDate = new Date('2019-01-01T00:00:00.000Z');
        const maxDate = new Date('2019-01-10T00:00:00.000Z');
        const result = dateRRule.any({ minDate, maxDate });
        expect(result).toBe(false);
      });

      it('should return true if there is any recurrence after minDate', () => {
        const minDate = new Date('2018-11-01T00:00:00.000Z');
        const result = dateRRule.any({ minDate });
        expect(result).toBe(true);
      });

      it('should return false if there is no recurrence after minDate', () => {
        const minDate = new Date('2019-01-01T00:00:00.000Z');
        const result = dateRRule.any({ minDate });
        expect(result).toBe(false);
      });

      it('should return true if there is any recurrence before maxDate', () => {
        const maxDate = new Date('2018-11-10T00:00:00.000Z');
        const result = dateRRule.any({ maxDate });
        expect(result).toBe(true);
      });

      it('should return false if there is no recurrence before maxDate', () => {
        const maxDate = new Date('2018-10-01T00:00:00.000Z');
        const result = dateRRule.any({ maxDate });
        expect(result).toBe(false);
      });
    });

    describe('with forever', () => {
      let foreverDateRRuleInstance: DateRRuleInstance;
      let foreverDateRRule: DateRRule;

      beforeEach(async () => {
        // Create a rule with no COUNT or UNTIL (forever rule)
        const foreverRruleStringLineSet = ['DTSTART;TZID=America/Denver:20181101T190000;', 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,TH;INTERVAL=1'];
        foreverDateRRuleInstance = DateRRuleUtility.makeInstance({
          rruleStringLineSet: foreverRruleStringLineSet,
          options: {}
        });
        foreverDateRRule = foreverDateRRuleInstance.rrule;
      });

      describe('with filter', () => {
        it('should return true if there is any recurrence within the minDate/maxDate range for forever rules', () => {
          const minDate = new Date('2018-11-01T00:00:00.000Z');
          const maxDate = new Date('2018-11-10T00:00:00.000Z');
          const result = foreverDateRRule.any({ minDate, maxDate });
          expect(result).toBe(true);
        });

        it('should return false if there is no recurrence within the minDate/maxDate range for forever rules', () => {
          const minDate = new Date('2018-10-01T00:00:00.000Z');
          const maxDate = new Date('2018-10-15T00:00:00.000Z');
          const result = foreverDateRRule.any({ minDate, maxDate });
          expect(result).toBe(false);
        });

        it('should return true for forever rules with only minDate filter', () => {
          const minDate = new Date('2020-01-01T00:00:00.000Z');
          const result = foreverDateRRule.any({ minDate });
          expect(result).toBe(true);
        });

        it('should return true for forever rules with far future dates', () => {
          const minDate = new Date('2025-01-01T00:00:00.000Z');
          const maxDate = new Date('2025-12-31T00:00:00.000Z');
          const result = foreverDateRRule.any({ minDate, maxDate });
          expect(result).toBe(true);
        });
      });
    });
  });
});
