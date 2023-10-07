import { dateCellIndexsForDateCellScheduleDayCodes } from './date.cell.schedule.day';
import { DateCellScheduleDayCode, weekdayDateCellScheduleDayCodes } from './date.cell.schedule';

describe('dateCellIndexsForDateCellScheduleDayCodes()', () => {
  describe('days array', () => {
    it('should create dateCellIndexes for the input day', () => {
      const sundayIndex = 0;
      const days = DateCellScheduleDayCode.SUNDAY;

      const result = dateCellIndexsForDateCellScheduleDayCodes(sundayIndex, days);
      expect(result[0]).toBe(0); // sunday is the first day
    });

    it('should create dateCellIndexes for the input days', () => {
      const sundayIndex = 0;
      const days = [DateCellScheduleDayCode.SUNDAY, DateCellScheduleDayCode.MONDAY];

      const result = dateCellIndexsForDateCellScheduleDayCodes(sundayIndex, days);
      expect(result[0]).toBe(0); // sunday is the first day
      expect(result[1]).toBe(1); // monday is the second day
    });
  });

  describe('string input', () => {
    it('should create dateCellIndexes for the input encoded week', () => {
      const sundayIndex = 0;
      const weekdays = DateCellScheduleDayCode.WEEKDAY;
      const expectedDays = weekdayDateCellScheduleDayCodes();

      const result = dateCellIndexsForDateCellScheduleDayCodes(sundayIndex, weekdays);

      expect(result.length).toBe(expectedDays.length);

      expect(result[0]).toBe(sundayIndex + 1); // sunday is the first day
      expect(result[1]).toBe(sundayIndex + 2);
      expect(result[2]).toBe(sundayIndex + 3);
      expect(result[3]).toBe(sundayIndex + 4);
      expect(result[4]).toBe(sundayIndex + 5);
    });
  });
});
