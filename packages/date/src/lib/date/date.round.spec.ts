import { roundDateTimeDownToSteps, roundDateTimeDown, roundToMinuteSteps } from './date.round';

describe('date.round', () => {
  describe('roundToMinuteSteps()', () => {
    it('should round minutes up to the nearest step', () => {
      const date = new Date(2024, 0, 1, 10, 7, 0);
      const result = roundToMinuteSteps(date, 15);
      expect(result.getMinutes()).toBe(15);
    });

    it('should not change the date if step is 1', () => {
      const date = new Date(2024, 0, 1, 10, 7, 0);
      const result = roundToMinuteSteps(date, 1);
      expect(result.getTime()).toBe(date.getTime());
    });

    it('should increment the hour if rounding pushes minutes to 60', () => {
      const date = new Date(2024, 0, 1, 10, 55, 0);
      const result = roundToMinuteSteps(date, 15);
      expect(result.getHours()).toBe(11);
      expect(result.getMinutes()).toBe(0);
    });

    it('should not change the date if minutes already align with step', () => {
      const date = new Date(2024, 0, 1, 10, 30, 0);
      const result = roundToMinuteSteps(date, 15);
      expect(result.getMinutes()).toBe(30);
    });
  });

  describe('roundDateTimeDown()', () => {
    it('should clear seconds and milliseconds when roundDownToMinute is true', () => {
      const date = new Date(2024, 0, 1, 10, 7, 30, 500);
      const result = roundDateTimeDown(date, { roundDownToMinute: true });
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });

    it('should clear hours and minutes when roundDownToDay is true', () => {
      const date = new Date(2024, 0, 1, 10, 7, 30, 500);
      const result = roundDateTimeDown(date, { roundDownToDay: true, roundDownToMinute: true });
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
    });
  });

  describe('roundDateTimeDownToSteps()', () => {
    it('should round to steps and then round down', () => {
      const date = new Date(2024, 0, 1, 10, 7, 30, 500);
      const result = roundDateTimeDownToSteps(date, { step: 15, roundDownToMinute: true });
      expect(result.getMinutes()).toBe(15);
      expect(result.getSeconds()).toBe(0);
    });
  });
});
