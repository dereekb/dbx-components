import { addHours } from 'date-fns';
import { fitDateRangeToDayPeriod } from './date.range.timezone';
import { dateTimezoneUtcNormal } from './date.timezone';

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

              // TODO(TEST): complete this test
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
