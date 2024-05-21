import { endOfDay, startOfDay } from 'date-fns';
import { DateTimeMinuteInstance } from '.';

describe('DateTimeMinuteInstance', () => {
  describe('dateDayContainsValidDateValue()', () => {
    it('should return true for a min/max limit a specific minute.', () => {
      const now = new Date();

      const limits = { min: now, max: now };
      const instance = new DateTimeMinuteInstance({ limits });

      expect(instance.dateDayContainsValidDateValue(now)).toBe(true);
      expect(instance.dateDayContainsValidDateValue(startOfDay(now))).toBe(true);
      expect(instance.dateDayContainsValidDateValue(endOfDay(now))).toBe(true);
    });
  });
});
