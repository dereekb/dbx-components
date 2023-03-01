import { dateBlockIndexsForDateScheduleDayCodes } from './date.block.day';
import { DateScheduleDayCode } from './date.schedule';

describe('dateBlockIndexsForDateScheduleDayCodes()', () => {
  it('should create dateBlockIndexes for the input day', () => {
    const sundayIndex = 0;
    const days = DateScheduleDayCode.SUNDAY;

    const result = dateBlockIndexsForDateScheduleDayCodes(sundayIndex, days);
    expect(result[0]).toBe(0); // sunday is the first day
  });

  it('should create dateBlockIndexes for the input days', () => {
    const sundayIndex = 0;
    const days = [DateScheduleDayCode.SUNDAY, DateScheduleDayCode.MONDAY];

    const result = dateBlockIndexsForDateScheduleDayCodes(sundayIndex, days);
    expect(result[0]).toBe(0); // sunday is the first day
    expect(result[1]).toBe(1); // monday is the second day
  });
});
