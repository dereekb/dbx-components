import { itShouldFail, expectFail } from '@dereekb/util/test';
import { startOfDay, addDays, addHours, addWeeks, startOfWeek, endOfWeek, endOfDay } from 'date-fns';
import { clampDateFunction, clampDateRangeFunction, dateRange, dateRangeOverlapsDateRangeFunction, DateRangeType, expandDaysForDateRangeFunction, fitDateRangeToDayPeriod, getDaysOfWeekInDateRange, isDateInDateRangeFunction, isDateRangeInDateRangeFunction, isSameDateDayRange, iterateDaysInDateRangeFunction } from './date.range';
import { transformDateRangeToTimezoneFunction } from './date.range.timezone';

describe('transformDateRangeToTimezone()', () => {
  describe('function', () => {
    const fn = transformDateRangeToTimezoneFunction('America/Denver', 'systemDateToTargetDate');

    const dateRangeInUTC = {
      start: new Date('2023-03-11T06:00:00.000Z'),
      end: new Date('2023-03-12T06:00:00.000Z')
    };

    it('should transform the date range.', () => {
      const expectedStart = fn._timezoneInstance.systemDateToTargetDate(dateRangeInUTC.start);
      const expectedEnd = fn._timezoneInstance.systemDateToTargetDate(dateRangeInUTC.end);

      const result = fn(dateRangeInUTC);

      expect(result.start).toBeSameSecondAs(expectedStart);
      expect(result.end).toBeSameSecondAs(expectedEnd);
    });
  });
});
