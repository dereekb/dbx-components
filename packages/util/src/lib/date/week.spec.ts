import { Day, daysOfWeekArray, daysOfWeekNameFunction, daysOfWeekNameMap, getDayOffset, getNextDay, getPreviousDay, dayOfWeek, isInAllowedDaysOfWeekSet, enabledDaysFromDaysOfWeek, daysOfWeekFromEnabledDays, getDaysOfWeekNames, getDayTomorrow, getDayYesterday } from './week';

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

describe('dayOfWeek()', () => {
  it('should return the correct day of the week for a given date', () => {
    // Test a few known dates
    // January 1, 2023 was a Sunday
    expect(dayOfWeek(new Date(2023, 0, 1))).toBe(Day.SUNDAY);
    // January 2, 2023 was a Monday
    expect(dayOfWeek(new Date(2023, 0, 2))).toBe(Day.MONDAY);
    // January 7, 2023 was a Saturday
    expect(dayOfWeek(new Date(2023, 0, 7))).toBe(Day.SATURDAY);
  });
});

describe('isInAllowedDaysOfWeekSet()', () => {
  const allowedDays = new Set([Day.MONDAY, Day.WEDNESDAY, Day.FRIDAY]);
  const decisionFn = isInAllowedDaysOfWeekSet(allowedDays);

  it('should return true if the DayOfWeek is in the set', () => {
    expect(decisionFn(Day.MONDAY)).toBe(true);
    expect(decisionFn(Day.WEDNESDAY)).toBe(true);
  });

  it('should return false if the DayOfWeek is not in the set', () => {
    expect(decisionFn(Day.TUESDAY)).toBe(false);
    expect(decisionFn(Day.SUNDAY)).toBe(false);
  });

  it('should return true if the date falls on an allowed DayOfWeek', () => {
    // Monday, January 2, 2023
    expect(decisionFn(new Date(2023, 0, 2))).toBe(true);
    // Wednesday, January 4, 2023
    expect(decisionFn(new Date(2023, 0, 4))).toBe(true);
  });

  it('should return false if the date does not fall on an allowed DayOfWeek', () => {
    // Sunday, January 1, 2023
    expect(decisionFn(new Date(2023, 0, 1))).toBe(false);
    // Tuesday, January 3, 2023
    expect(decisionFn(new Date(2023, 0, 3))).toBe(false);
  });
});

describe('enabledDaysFromDaysOfWeek()', () => {
  it('should return an EnabledDays object with true for specified days', () => {
    const days = [Day.MONDAY, Day.FRIDAY];
    const enabled = enabledDaysFromDaysOfWeek(days);
    expect(enabled.monday).toBe(true);
    expect(enabled.friday).toBe(true);
    expect(enabled.tuesday).toBe(false);
    expect(enabled.sunday).toBe(false);
  });

  it('should return an EnabledDays object with all false if input is null or empty', () => {
    let enabled = enabledDaysFromDaysOfWeek(null);
    expect(enabled.monday).toBe(false);
    expect(enabled.tuesday).toBe(false);
    expect(enabled.wednesday).toBe(false);
    expect(enabled.thursday).toBe(false);
    expect(enabled.friday).toBe(false);
    expect(enabled.saturday).toBe(false);
    expect(enabled.sunday).toBe(false);
    enabled = enabledDaysFromDaysOfWeek([]);
    expect(enabled.monday).toBe(false);
    expect(enabled.tuesday).toBe(false);
    expect(enabled.wednesday).toBe(false);
    expect(enabled.thursday).toBe(false);
    expect(enabled.friday).toBe(false);
    expect(enabled.saturday).toBe(false);
    expect(enabled.sunday).toBe(false);
  });
});

describe('daysOfWeekFromEnabledDays()', () => {
  it('should return an array of Day enums from an EnabledDays object', () => {
    const enabled = {
      sunday: false,
      monday: true,
      tuesday: false,
      wednesday: true,
      thursday: false,
      friday: true,
      saturday: false
    };
    const days = daysOfWeekFromEnabledDays(enabled);
    expect(days).toContain(Day.MONDAY);
    expect(days).toContain(Day.WEDNESDAY);
    expect(days).toContain(Day.FRIDAY);
    expect(days.length).toBe(3);
  });

  it('should return an empty array if input is null or all days are false', () => {
    let days = daysOfWeekFromEnabledDays(null);
    expect(days.length).toBe(0);

    const allFalse = {
      sunday: false,
      monday: false,
      tuesday: false,
      wednesday: false,
      thursday: false,
      friday: false,
      saturday: false
    };
    days = daysOfWeekFromEnabledDays(allFalse);
    expect(days.length).toBe(0);
  });
});

describe('getDaysOfWeekNames()', () => {
  it('should return full day names starting with Sunday by default', () => {
    const names = getDaysOfWeekNames();
    expect(names.length).toBe(7);
    expect(names[0]).toBe('Sunday');
    expect(names[6]).toBe('Saturday');
  });

  it('should return full day names starting with Monday if sundayFirst is false', () => {
    const names = getDaysOfWeekNames(false);
    expect(names.length).toBe(7);
    expect(names[0]).toBe('Monday');
    expect(names[6]).toBe('Sunday');
  });

  it('should return abbreviated day names when transform.abbreviation is true', () => {
    const names = getDaysOfWeekNames(true, { abbreviation: true });
    expect(names[0]).toBe('Sun');
    expect(names[1]).toBe('Mon');
  });

  it('should return uppercase day names when transform.uppercase is true', () => {
    const names = getDaysOfWeekNames(true, { uppercase: true });
    expect(names[0]).toBe('SUNDAY');
    expect(names[1]).toBe('MONDAY');
  });

  it('should return uppercase abbreviated day names when both transform options are true', () => {
    const names = getDaysOfWeekNames(true, { abbreviation: true, uppercase: true });
    expect(names[0]).toBe('SUN');
    expect(names[1]).toBe('MON');
  });

  it('should correctly apply transformations when sundayFirst is false', () => {
    const namesAbbr = getDaysOfWeekNames(false, { abbreviation: true });
    expect(namesAbbr[0]).toBe('Mon');
    expect(namesAbbr[6]).toBe('Sun');

    const namesUpper = getDaysOfWeekNames(false, { uppercase: true });
    expect(namesUpper[0]).toBe('MONDAY');
    expect(namesUpper[6]).toBe('SUNDAY');

    const namesAbbrUpper = getDaysOfWeekNames(false, { abbreviation: true, uppercase: true });
    expect(namesAbbrUpper[0]).toBe('MON');
    expect(namesAbbrUpper[6]).toBe('SUN');
  });
});

describe('getDayTomorrow()', () => {
  it('should return the next day of the week', () => {
    expect(getDayTomorrow(Day.SUNDAY)).toBe(Day.MONDAY);
    expect(getDayTomorrow(Day.MONDAY)).toBe(Day.TUESDAY);
    expect(getDayTomorrow(Day.SATURDAY)).toBe(Day.SUNDAY);
  });
});

describe('getDayYesterday()', () => {
  it('should return the previous day of the week', () => {
    expect(getDayYesterday(Day.SUNDAY)).toBe(Day.SATURDAY);
    expect(getDayYesterday(Day.MONDAY)).toBe(Day.SUNDAY);
    expect(getDayYesterday(Day.SATURDAY)).toBe(Day.FRIDAY);
  });
});
