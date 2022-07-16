import { Day, getDayOffset, getNextDay, getPreviousDay } from './week';

describe('getDayOffset()', () => {
  it('should return the previous days if a negative value is input.', () => {
    expect(getDayOffset(Day.SATURDAY, -1)).toBe(Day.FRIDAY);
    expect(getDayOffset(Day.SUNDAY, -1)).toBe(Day.SATURDAY);
  });

  it('should return the next days if a positive value is input.', () => {
    expect(getDayOffset(Day.SATURDAY, 1)).toBe(Day.SUNDAY);
    expect(getDayOffset(Day.SUNDAY, 1)).toBe(Day.MONDAY);
  });
});

describe('getPreviousDay()', () => {
  it('should return the previous day', () => {
    expect(getPreviousDay(Day.SATURDAY)).toBe(Day.FRIDAY);
    expect(getPreviousDay(Day.SUNDAY)).toBe(Day.SATURDAY);
  });

  it('should return the previous days if a negative value is input.', () => {
    expect(getPreviousDay(Day.SATURDAY, -1)).toBe(Day.FRIDAY);
    expect(getPreviousDay(Day.SUNDAY, -1)).toBe(Day.SATURDAY);
  });

  it('should return the previous days if a positive value is input.', () => {
    expect(getPreviousDay(Day.SATURDAY, -1)).toBe(Day.FRIDAY);
    expect(getPreviousDay(Day.SUNDAY, -1)).toBe(Day.SATURDAY);
  });

  it('should return the previous days for the number of days input.', () => {
    expect(getPreviousDay(Day.SATURDAY, 5)).toBe(Day.MONDAY);
  });
});

describe('getNextDay()', () => {
  it('should return the next.', () => {
    expect(getNextDay(Day.FRIDAY)).toBe(Day.SATURDAY);
    expect(getNextDay(Day.SUNDAY)).toBe(Day.MONDAY);
  });

  it('should return the next days for the number of days input.', () => {
    expect(getNextDay(Day.FRIDAY, 4)).toBe(Day.TUESDAY);
  });
});
