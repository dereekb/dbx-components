import { dateCellIndexsForDateScheduleDayCodes } from './date.cell.day';
import { DateScheduleDayCode, weekdayDateScheduleDayCodes } from './date.schedule';

describe('dateCellIndexsForDateScheduleDayCodes()', () => {
  describe('days array', () => {
    it('should create dateCellIndexes for the input day', () => {
      const sundayIndex = 0;
      const days = DateScheduleDayCode.SUNDAY;

      const result = dateCellIndexsForDateScheduleDayCodes(sundayIndex, days);
      expect(result[0]).toBe(0); // sunday is the first day
    });

    it('should create dateCellIndexes for the input days', () => {
      const sundayIndex = 0;
      const days = [DateScheduleDayCode.SUNDAY, DateScheduleDayCode.MONDAY];

      const result = dateCellIndexsForDateScheduleDayCodes(sundayIndex, days);
      expect(result[0]).toBe(0); // sunday is the first day
      expect(result[1]).toBe(1); // monday is the second day
    });
  });

  describe('string input', () => {
    it('should create dateCellIndexes for the input encoded week', () => {
      const sundayIndex = 0;
      const weekdays = DateScheduleDayCode.WEEKDAY;
      const expectedDays = weekdayDateScheduleDayCodes();

      const result = dateCellIndexsForDateScheduleDayCodes(sundayIndex, weekdays);

      expect(result.length).toBe(expectedDays.length);

      expect(result[0]).toBe(sundayIndex + 1); // sunday is the first day
      expect(result[1]).toBe(sundayIndex + 2);
      expect(result[2]).toBe(sundayIndex + 3);
      expect(result[3]).toBe(sundayIndex + 4);
      expect(result[4]).toBe(sundayIndex + 5);
    });
  });
});
