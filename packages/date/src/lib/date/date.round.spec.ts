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

    it('should not change the seconds', () => {
      const date = new Date(2024, 0, 1, 10, 7, 30);
      const result = roundToMinuteSteps(date, 15);
      expect(result.getMinutes()).toBe(15);
      expect(result.getSeconds()).toBe(30);
    });

    it('should align steps that do not evenly divide an hour to the start of the day', () => {
      const date = new Date(2024, 0, 1, 10, 50, 0);
      const result = roundToMinuteSteps(date, 45);
      expect(result.getHours()).toBe(11);
      expect(result.getMinutes()).toBe(15);
    });

    it('should round to the start of the next day if rounding passes the end of the day', () => {
      const date = new Date(2024, 0, 1, 23, 55, 0);
      const result = roundToMinuteSteps(date, 15);
      expect(result.getTime()).toBe(new Date(2024, 0, 2, 0, 0, 0).getTime());
    });

    it('should round to the start of the next day for a step that does not evenly divide the day', () => {
      const date = new Date(2024, 0, 1, 23, 59, 0);
      const result = roundToMinuteSteps(date, 7);
      expect(result.getTime()).toBe(new Date(2024, 0, 2, 0, 0, 0).getTime());
    });

    it('should throw if the step is greater than 1 and is not an integer', () => {
      const date = new Date(2024, 0, 1, 10, 7, 0);
      expect(() => roundToMinuteSteps(date, 7.5)).toThrow();
    });

    it('should not change the date if the step is a fraction of 1 or less', () => {
      const date = new Date(2024, 0, 1, 10, 7, 0);
      const result = roundToMinuteSteps(date, 0.5);
      expect(result.getTime()).toBe(date.getTime());
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
