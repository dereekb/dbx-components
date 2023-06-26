import { Day, daysOfWeekArray, daysOfWeekNameFunction, daysOfWeekNameMap, getDayOffset, getNextDay, getPreviousDay } from './week';

describe('daysOfWeekArray()', () => {
  it('should return all the days of the week.', () => {
    const result = daysOfWeekArray();
    expect(result.length).toBe(7);
  });

  it('should return all the days of the week starting with Wednesday.', () => {
    const result = daysOfWeekArray(Day.WEDNESDAY);
    expect(result.length).toBe(7);
    expect(result[0]).toBe(Day.WEDNESDAY);
    expect(result[1]).toBe(Day.THURSDAY);
    expect(result[2]).toBe(Day.FRIDAY);
    expect(result[3]).toBe(Day.SATURDAY);
    expect(result[4]).toBe(Day.SUNDAY);
    expect(result[5]).toBe(Day.MONDAY);
    expect(result[6]).toBe(Day.TUESDAY);
  });

  it('should return 3 days starting with Wednesday.', () => {
    const result = daysOfWeekArray(Day.WEDNESDAY, 3);
    expect(result.length).toBe(3);
    expect(result[0]).toBe(Day.WEDNESDAY);
    expect(result[1]).toBe(Day.THURSDAY);
    expect(result[2]).toBe(Day.FRIDAY);
  });
});

describe('daysOfWeekNameMap()', () => {
  it('it should return a map for each day of the week.', () => {
    const map = daysOfWeekNameMap();

    expect(map.size).toBe(7);
    expect(map.get(Day.SUNDAY)).toBe('Sunday');
    expect(map.get(Day.MONDAY)).toBe('Monday');
    expect(map.get(Day.TUESDAY)).toBe('Tuesday');
    expect(map.get(Day.WEDNESDAY)).toBe('Wednesday');
    expect(map.get(Day.THURSDAY)).toBe('Thursday');
    expect(map.get(Day.FRIDAY)).toBe('Friday');
    expect(map.get(Day.SATURDAY)).toBe('Saturday');
  });
});

describe('daysOfWeekNameFunction()', () => {
  it('it should return the name for the day of the week.', () => {
    const map = daysOfWeekNameFunction();

    expect(map(Day.SUNDAY)).toBe('Sunday');
    expect(map(Day.MONDAY)).toBe('Monday');
    expect(map(Day.TUESDAY)).toBe('Tuesday');
    expect(map(Day.WEDNESDAY)).toBe('Wednesday');
    expect(map(Day.THURSDAY)).toBe('Thursday');
    expect(map(Day.FRIDAY)).toBe('Friday');
    expect(map(Day.SATURDAY)).toBe('Saturday');
  });

  it('it should return the name for the day of the week with abbreviation', () => {
    const map = daysOfWeekNameFunction({ abbreviation: true });

    expect(map(Day.SUNDAY)).toBe('Sun');
    expect(map(Day.MONDAY)).toBe('Mon');
    expect(map(Day.TUESDAY)).toBe('Tue');
    expect(map(Day.WEDNESDAY)).toBe('Wed');
    expect(map(Day.THURSDAY)).toBe('Thu');
    expect(map(Day.FRIDAY)).toBe('Fri');
    expect(map(Day.SATURDAY)).toBe('Sat');
  });

  it('it should return the name for the day of the week with uppercase abbreviation.', () => {
    const map = daysOfWeekNameFunction({ abbreviation: true, uppercase: true });

    expect(map(Day.SUNDAY)).toBe('SUN');
    expect(map(Day.MONDAY)).toBe('MON');
    expect(map(Day.TUESDAY)).toBe('TUE');
    expect(map(Day.WEDNESDAY)).toBe('WED');
    expect(map(Day.THURSDAY)).toBe('THU');
    expect(map(Day.FRIDAY)).toBe('FRI');
    expect(map(Day.SATURDAY)).toBe('SAT');
  });
});

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
