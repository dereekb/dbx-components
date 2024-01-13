import { dateCellTiming, type DateCellIndex } from './date.cell';
import { systemNormalDateToBaseDate } from './date.timezone';
import { dateCellDayOfWeekFactory, dateCellIndexYearWeekCodeFactory, dateCellIndexYearWeekCodeGroupFactory } from './date.cell.week';
import { yearWeekCodeFromDate } from './date.week';
import { addDays } from 'date-fns';
import { range, Day } from '@dereekb/util';

describe('dateCellDayOfWeekFactory()', () => {
  describe('function', () => {
    describe('from sunday', () => {
      const factoryFromSunday = dateCellDayOfWeekFactory(Day.SUNDAY);

      it('should return the proper day of the week.', () => {
        range(Day.SUNDAY, Day.SATURDAY).map((i: DateCellIndex) => {
          const result = factoryFromSunday(i);
          expect(result).toBe(i);
        });
      });

      it('should wrap around week.', () => {
        range(Day.SUNDAY, Day.SATURDAY).map((i: DateCellIndex) => {
          const result = factoryFromSunday(i + 7); // add a full week to the index.
          expect(result).toBe(i);
        });
      });
    });

    describe('from saturday', () => {
      const factoryFromSaturday = dateCellDayOfWeekFactory(Day.SATURDAY);

      it('should return the day of the week for the input index.', () => {
        expect(factoryFromSaturday(0)).toBe(Day.SATURDAY);
        expect(factoryFromSaturday(1)).toBe(Day.SUNDAY);
        expect(factoryFromSaturday(2)).toBe(Day.MONDAY);
        expect(factoryFromSaturday(3)).toBe(Day.TUESDAY);
        expect(factoryFromSaturday(4)).toBe(Day.WEDNESDAY);
      });
    });
  });
});

describe('dateCellIndexYearWeekCodeFactory()', () => {
  describe('function', () => {
    const startsAt = systemNormalDateToBaseDate(new Date('2022-01-02T00:00:00Z')); // Sunday
    const startsAtWeek = yearWeekCodeFromDate(startsAt);
    const timing = dateCellTiming({ startsAt, duration: 60 }, 1); // Sunday only
    const factory = dateCellIndexYearWeekCodeFactory({ timing });

    it('should return the expected week for the startsAt date', () => {
      const result = factory(startsAt);
      expect(result).toBe(startsAtWeek);
    });

    it('should return the expected week for the following week', () => {
      const date = addDays(startsAt, 9);
      const expectedWeek = yearWeekCodeFromDate(date);

      const result = factory(date);
      expect(result).toBe(expectedWeek);
    });
  });
});

interface TestGroupValue {
  i: DateCellIndex;
}

describe('dateCellIndexYearWeekCodeGroupFactory()', () => {
  describe('function', () => {
    const startsAt = systemNormalDateToBaseDate(new Date('2022-01-02T00:00:00Z')); // Sunday
    const startsAtWeek = yearWeekCodeFromDate(startsAt);
    const timing = dateCellTiming({ startsAt, duration: 60 }, 1); // Sunday only
    const groupValues = dateCellIndexYearWeekCodeGroupFactory<TestGroupValue>({
      dateCellIndexReader: (x) => x.i,
      dateCellIndexYearWeekCodeFactory: {
        timing
      }
    });

    it('should group the input values to weeks.', () => {
      const values: TestGroupValue[] = [{ i: 0 }, { i: 9 }];

      const result = groupValues(values);
      expect(result.length).toBe(2);

      expect(result[0].week).toBe(startsAtWeek);
      expect(result[1].week).toBe(startsAtWeek + 1);
    });
  });
});
