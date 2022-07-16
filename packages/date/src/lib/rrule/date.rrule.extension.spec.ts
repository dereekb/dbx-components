import { DateRRule } from './date.rrule.extension';
import { DateRRuleInstance, DateRRuleUtility } from '@dereekb/date';

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
      // todo
    });
  });

  describe('last()', () => {
    it('should return the last recurrence', () => {
      const result = dateRRule.last();
      expect(result).toBeSameSecondAs(lastDate);
    });

    describe('with minDate', () => {
      // todo
    });

    describe('with forever', () => {
      // todo
    });
  });

  describe('any()', () => {
    it('should return true if there is any recurrence.', () => {
      const result = dateRRule.any();
      expect(result).toBe(true);
    });

    describe('with filter', () => {
      // todo
    });

    describe('with forever', () => {
      describe('with filter', () => {
        // todo
      });
    });
  });
});
