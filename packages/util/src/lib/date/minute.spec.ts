import { MS_IN_SECOND } from './date';
import { millisecondsToMinutesAndSeconds, minutesIncrementConverter, secondsToMinutesAndSeconds } from './minute';

describe('millisecondsToMinutesAndSeconds()', () => {
  it('should convert milliseconds to minutes and seconds', () => {
    const result = millisecondsToMinutesAndSeconds(123 * MS_IN_SECOND);
    expect(result).toEqual({ minute: 2, second: 3 });
  });
});

describe('secondsToMinutesAndSeconds()', () => {
  it('should convert seconds to minutes and seconds', () => {
    const result = secondsToMinutesAndSeconds(123);
    expect(result).toEqual({ minute: 2, second: 3 });
  });
});

describe('minutesIncrementConverter()', () => {
  it('should throw if the increment is zero', () => {
    expect(() => minutesIncrementConverter(0)).toThrow();
  });

  it('should throw if the increment is negative', () => {
    expect(() => minutesIncrementConverter(-15)).toThrow();
  });

  it('should throw if the increment is not an integer', () => {
    expect(() => minutesIncrementConverter(7.5)).toThrow();
  });

  describe('function', () => {
    const converter = minutesIncrementConverter(15);

    describe('reduce()', () => {
      it('should reduce the minutes to the number of whole increments', () => {
        expect(converter.reduce(0)).toBe(0);
        expect(converter.reduce(10)).toBe(0);
        expect(converter.reduce(50)).toBe(3);
        expect(converter.reduce(720)).toBe(48);
      });

      it('should not wrap minutes past the end of the day', () => {
        expect(converter.reduce(1440)).toBe(96);
        expect(converter.reduce(1500)).toBe(100);
      });
    });

    describe('expand()', () => {
      it('should expand the increment to minutes', () => {
        expect(converter.expand(3)).toBe(45);
        expect(converter.expand(48)).toBe(720);
      });
    });

    describe('round()', () => {
      it('should round the minutes down to a multiple of the increment', () => {
        expect(converter.round(50)).toBe(45);
        expect(converter.round(45)).toBe(45);
      });
    });
  });

  describe('config', () => {
    it('should round up when rounding is ceil', () => {
      const converter = minutesIncrementConverter({ increment: 15, round: 'ceil' });
      expect(converter.reduce(10)).toBe(1);
      expect(converter.round(50)).toBe(60);
    });

    describe('allowFractionalIncrement', () => {
      it('should allow a fractional increment', () => {
        const converter = minutesIncrementConverter({ increment: 7.5, allowFractionalIncrement: true });
        expect(converter.reduce(50)).toBe(6);
        expect(converter.expand(1)).toBe(7.5);
        expect(converter.round(50)).toBe(45);
      });

      it('should still throw if the increment is zero', () => {
        expect(() => minutesIncrementConverter({ increment: 0, allowFractionalIncrement: true })).toThrow();
      });

      it('should still throw if the increment is negative', () => {
        expect(() => minutesIncrementConverter({ increment: -7.5, allowFractionalIncrement: true })).toThrow();
      });
    });
  });
});
