import { MINUTES_IN_HOUR, range } from '@dereekb/util';
import { computeNextFractionalHour, fractionalHoursToMinutes, hourToFractionalHour, minutesToFractionalHours } from './hour';

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
