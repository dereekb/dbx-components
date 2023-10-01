import { addHours } from 'date-fns';
import { fitDateRangeToDayPeriod, transformDateRangeToTimezoneFunction } from './date.range.timezone';
import { dateTimezoneUtcNormal } from './date.timezone';

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

describe('fitDateRangeToDayPeriodFunction()', () => {
  describe('function', () => {
    describe('scenario', () => {
      describe('daylight savings', () => {
        describe('America/Denver', () => {
          const timezone = 'America/Denver';
          const timezoneInstance = dateTimezoneUtcNormal({ timezone });
          const daylightSavingsLastDayActive = timezoneInstance.targetDateToBaseDate(new Date('2023-11-03T00:00:00Z'));
          const daylightSavingsBeforeFirstDayActive = timezoneInstance.targetDateToBaseDate(new Date('2023-03-10T00:00:00Z'));

          describe('active to inactive', () => {
            it(`should return the proper timing with new duration of the day after daylight savings goes inactive in ${timezone}`, () => {
              const dateRange = { start: daylightSavingsLastDayActive, end: timezoneInstance.transformDateInTimezoneNormalFunction('systemDateToTargetDate')(daylightSavingsLastDayActive, (x) => addHours(x, 48)) };
              const result = fitDateRangeToDayPeriod(dateRange, timezone);

              // TODO: ...
            });
          });

          describe('inactive to active', () => {
            it(`should return the proper timing with new duration of the day after daylight savings goes active in ${timezone}`, () => {});
          });
        });
      });
    });
  });
});
