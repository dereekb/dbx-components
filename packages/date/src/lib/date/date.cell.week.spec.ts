import { dateCellTiming, DateCellIndex } from './date.cell';
import { systemNormalDateToBaseDate } from './date.timezone';
import { dateCellIndexYearWeekCodeFactory, dateCellIndexYearWeekCodeGroupFactory } from './date.cell.week';
import { yearWeekCodeFromDate } from './date.week';
import { addDays } from 'date-fns';

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
