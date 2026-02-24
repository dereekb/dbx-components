import { startOfDay } from 'date-fns';
import { range } from '../array/array.number';
import { MINUTES_IN_HOUR } from './date';
import { asMinuteOfDay, computeNextFractionalHour, dateFromMinuteOfDay, dateToHoursAndMinutes, dateToMinuteOfDay, fractionalHoursToMinutes, hourToFractionalHour, hoursAndMinutesToString, isMinuteOfDay, minutesToFractionalHours, minutesToHoursAndMinutes, toMinuteOfDay } from './hour';

describe('fractionalHoursToMinutes()', () => {
  it('should convert the fractional hours to minutes.', () => {
    const numberOfMinutesInHour = 60;
    const allMinutes = range(0, numberOfMinutesInHour).map((minutes) => {
      const fractionalHour = minutesToFractionalHours(minutes);
      const backToMinutes = fractionalHoursToMinutes(fractionalHour);
      return [minutes, backToMinutes, fractionalHour];
    });

    allMinutes.forEach((x) => {
      expect(x[1]).toBe(x[0]);
    });
  });

  it('should convert the fractional hours to minutes.', () => {
    const numberOfHoursToTest = 24;
    const numberOfMinutesInHour = 60 * numberOfHoursToTest;
    const allMinutes = range(0, numberOfMinutesInHour).map((minutes) => {
      const fractionalHour = minutesToFractionalHours(minutes);
      const backToMinutes = fractionalHoursToMinutes(fractionalHour);
      return [minutes, backToMinutes, fractionalHour];
    });

    allMinutes.forEach((x) => {
      expect(x[1]).toBe(x[0]);
    });
  });
});

describe('hourToFractionalHour()', () => {
  it('should convert the fractional hours to and from', () => {
    const numberOfMinutesInHour = 60;
    const allMinutes = range(0, numberOfMinutesInHour).map((minutes) => {
      const fractionalHour = minutesToFractionalHours(minutes);
      const back = hourToFractionalHour(fractionalHour);
      return [minutes, fractionalHour, back];
    });

    allMinutes.forEach((x) => {
      expect(x[2]).toBe(x[1]);
    });
  });
});

describe('computeNextFractionalHour()', () => {
  it('should add minutes to a fractional hour', () => {
    for (let i = 0; i < MINUTES_IN_HOUR; i += 1) {
      for (let j = 0; j < MINUTES_IN_HOUR; j += 1) {
        const fractionalHour1 = minutesToFractionalHours(i);

        const fractionalAddition = computeNextFractionalHour(fractionalHour1, { minutes: j });
        const result = fractionalHoursToMinutes(fractionalAddition);

        expect(result).toBe(i + j);
      }
    }
  });

  it('should add hours to a fractional hour', () => {
    for (let i = 0; i < MINUTES_IN_HOUR; i += 1) {
      for (let j = 0; j < MINUTES_IN_HOUR; j += 1) {
        const fractionalHour1 = minutesToFractionalHours(i);

        const fractionalAddition = computeNextFractionalHour(fractionalHour1, { hours: minutesToFractionalHours(j) });
        const result = fractionalHoursToMinutes(fractionalAddition);

        expect(result).toBe(i + j);
      }
    }
  });

  it('should subtract minutes from a fractional hour', () => {
    for (let i = 0; i < MINUTES_IN_HOUR; i += 1) {
      for (let j = 0; j < MINUTES_IN_HOUR; j += 1) {
        const fractionalHour1 = minutesToFractionalHours(i);

        const fractionalAddition = computeNextFractionalHour(fractionalHour1, { minutes: -j });
        const result = fractionalHoursToMinutes(fractionalAddition);

        expect(result).toBe(i - j);
      }
    }
  });
});

describe('fractional hours', () => {
  describe('math', () => {
    it('should add two fractional hours to get the expected number of minutes.', () => {
      for (let i = 0; i < MINUTES_IN_HOUR; i += 1) {
        for (let j = 0; j < MINUTES_IN_HOUR; j += 1) {
          const fractionalHour1 = minutesToFractionalHours(i);
          const fractionalHour2 = minutesToFractionalHours(j);

          const fractionalAddition = fractionalHour1 + fractionalHour2;
          const result = fractionalHoursToMinutes(fractionalAddition);

          expect(result).toBe(i + j);
        }
      }
    });

    it('should subtract two fractional hours to get the expected number of minutes.', () => {
      for (let i = 0; i < MINUTES_IN_HOUR; i += 1) {
        for (let j = 0; j < MINUTES_IN_HOUR; j += 1) {
          const fractionalHour1 = minutesToFractionalHours(i);
          const fractionalHour2 = minutesToFractionalHours(j);

          const fractionalAddition = fractionalHour1 - fractionalHour2;
          const result = fractionalHoursToMinutes(fractionalAddition);

          expect(result).toBe(i - j);
        }
      }
    });
  });
});

describe('minutesToHoursAndMinutes()', () => {
  it('should convert 0 minutes to 0 hours', () => {
    const result = minutesToHoursAndMinutes(0);
    expect(result.hour).toBe(0);
    expect(result.minute).toBe(0);
  });

  it('should convert 60 minutes to 1 hour', () => {
    const result = minutesToHoursAndMinutes(MINUTES_IN_HOUR);
    expect(result.hour).toBe(1);
    expect(result.minute).toBe(0);
  });

  it('should convert -60 minutes to -1 hour', () => {
    const result = minutesToHoursAndMinutes(-MINUTES_IN_HOUR);
    expect(result.hour).toBe(-1);
    expect(result.minute).toBe(-0);
  });

  it('should convert 1439 minutes to 23 hours, 59 minutes', () => {
    const result = minutesToHoursAndMinutes(1439);
    expect(result.hour).toBe(23);
    expect(result.minute).toBe(59);
  });

  it('should convert 2000 minutes to 33 hours, 20 minutes', () => {
    const result = minutesToHoursAndMinutes(2000);
    expect(result.hour).toBe(33);
    expect(result.minute).toBe(20);
  });
});

describe('toMinuteOfDay()', () => {
  it('should convert 0 hours and 0 minutes to 0', () => {
    const result = toMinuteOfDay(0, 0);
    expect(result).toBe(0);
  });

  it('should convert 23 hours and 59 minutes to 1439 minutes', () => {
    const result = toMinuteOfDay(23, 59);
    expect(result).toBe(1439);
  });
});

describe('dateFromMinuteOfDay()', () => {
  it('should return a date with the 0 minute of the day', () => {
    const now = new Date();
    const date = dateFromMinuteOfDay(0, now);
    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
    expect(date).toBeSameSecondAs(startOfDay(now));
  });
});

describe('dateToMinuteOfDay()', () => {
  it('should convert midnight to 0', () => {
    const now = new Date();
    const midnight = startOfDay(now);
    const minuteOfDay = dateToMinuteOfDay(midnight);
    expect(minuteOfDay).toBe(0);
  });
});

describe('asMinuteOfDay()', () => {
  it('should convert 1440 minutes to 0', () => {
    const result = asMinuteOfDay(1440);
    expect(result).toBe(0);
  });

  it('should convert 720 minutes to 720', () => {
    const result = asMinuteOfDay(720);
    expect(result).toBe(720);
  });

  it('should convert 2000 minutes to 560', () => {
    const result = asMinuteOfDay(2000);
    expect(result).toBe(560);
  });
});

describe('isMinuteOfDay()', () => {
  it('should return true for numbers within the valid range (0-1439)', () => {
    expect(isMinuteOfDay(0)).toBe(true);
    expect(isMinuteOfDay(720)).toBe(true);
    expect(isMinuteOfDay(1439)).toBe(true);
  });

  it('should return false for numbers outside the valid range', () => {
    expect(isMinuteOfDay(-1)).toBe(false);
    expect(isMinuteOfDay(1440)).toBe(false);
    expect(isMinuteOfDay(10000)).toBe(false);
  });
});

describe('dateToHoursAndMinutes()', () => {
  it('should convert a Date object to hours and minutes for 10:30', () => {
    const date1 = new Date(2023, 0, 1, 10, 30, 0); // Jan 1, 2023, 10:30:00
    const result1 = dateToHoursAndMinutes(date1);
    expect(result1.hour).toBe(10);
    expect(result1.minute).toBe(30);
  });

  it('should convert a Date object to hours and minutes for 00:00', () => {
    const date2 = new Date(2023, 0, 1, 0, 0, 0); // Jan 1, 2023, 00:00:00
    const result2 = dateToHoursAndMinutes(date2);
    expect(result2.hour).toBe(0);
    expect(result2.minute).toBe(0);
  });

  it('should convert a Date object to hours and minutes for 23:59', () => {
    const date3 = new Date(2023, 0, 1, 23, 59, 0); // Jan 1, 2023, 23:59:00
    const result3 = dateToHoursAndMinutes(date3);
    expect(result3.hour).toBe(23);
    expect(result3.minute).toBe(59);
  });
});

describe('hoursAndMinutesToString()', () => {
  it('should return an empty string for zero hours and zero minutes', () => {
    expect(hoursAndMinutesToString({ hour: 0, minute: 0 })).toBe('');
  });

  it('should correctly format 1 hour and 30 minutes', () => {
    expect(hoursAndMinutesToString({ hour: 1, minute: 30 })).toBe('1 hours and 30 minutes');
  });

  it('should correctly format 2 hours and 15 minutes', () => {
    expect(hoursAndMinutesToString({ hour: 2, minute: 15 })).toBe('2 hours and 15 minutes');
  });

  it('should correctly format 1 hour only', () => {
    expect(hoursAndMinutesToString({ hour: 1, minute: 0 })).toBe('1 hours');
  });

  it('should correctly format 5 hours only', () => {
    expect(hoursAndMinutesToString({ hour: 5, minute: 0 })).toBe('5 hours');
  });

  it('should correctly format 45 minutes only', () => {
    expect(hoursAndMinutesToString({ hour: 0, minute: 45 })).toBe('45 minutes');
  });

  it('should correctly format 1 minute only', () => {
    expect(hoursAndMinutesToString({ hour: 0, minute: 1 })).toBe('1 minutes');
  });

  it('should correctly format 1 hour and 1 minute', () => {
    expect(hoursAndMinutesToString({ hour: 1, minute: 1 })).toBe('1 hours and 1 minutes');
  });
});
