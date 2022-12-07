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
    expect(getNextDay(Day.FRIDAY, 9)).toBe(Day.SUNDAY);
    expect(getNextDay(Day.FRIDAY, 8)).toBe(Day.SATURDAY);
    expect(getNextDay(Day.FRIDAY, 7)).toBe(Day.FRIDAY);
    expect(getNextDay(Day.FRIDAY, 6)).toBe(Day.THURSDAY);
    expect(getNextDay(Day.FRIDAY, 5)).toBe(Day.WEDNESDAY);
    expect(getNextDay(Day.FRIDAY, 4)).toBe(Day.TUESDAY);
    expect(getNextDay(Day.FRIDAY, 3)).toBe(Day.MONDAY);
    expect(getNextDay(Day.FRIDAY, 2)).toBe(Day.SUNDAY);
    expect(getNextDay(Day.FRIDAY, 1)).toBe(Day.SATURDAY);
    expect(getNextDay(Day.FRIDAY, 0)).toBe(Day.FRIDAY);
  });

  it('should return the next days for a negative number of days input.', () => {
    expect(getNextDay(Day.FRIDAY, 0)).toBe(Day.FRIDAY);
    expect(getNextDay(Day.FRIDAY, -1)).toBe(Day.THURSDAY);
    expect(getNextDay(Day.FRIDAY, -2)).toBe(Day.WEDNESDAY);
    expect(getNextDay(Day.FRIDAY, -3)).toBe(Day.TUESDAY);
    expect(getNextDay(Day.FRIDAY, -4)).toBe(Day.MONDAY);
    expect(getNextDay(Day.FRIDAY, -5)).toBe(Day.SUNDAY);
    expect(getNextDay(Day.FRIDAY, -6)).toBe(Day.SATURDAY);
    expect(getNextDay(Day.FRIDAY, -7)).toBe(Day.FRIDAY);
    expect(getNextDay(Day.FRIDAY, -8)).toBe(Day.THURSDAY);
    expect(getNextDay(Day.FRIDAY, -9)).toBe(Day.WEDNESDAY);
    expect(getNextDay(Day.FRIDAY, -10)).toBe(Day.TUESDAY);
    expect(getNextDay(Day.FRIDAY, -11)).toBe(Day.MONDAY);
  });
});
