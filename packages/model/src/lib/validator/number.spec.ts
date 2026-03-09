import { type } from 'arktype';
import { minuteOfDayType } from './number';

describe('minuteOfDayType', () => {
  it('should pass for minute 0', () => {
    const result = minuteOfDayType(0);
    expect(result instanceof type.errors).toBe(false);
  });

  it('should pass for minute 1439 (last minute of the day)', () => {
    const result = minuteOfDayType(1439);
    expect(result instanceof type.errors).toBe(false);
  });

  it('should pass for a mid-day minute', () => {
    const result = minuteOfDayType(720);
    expect(result instanceof type.errors).toBe(false);
  });

  it('should fail for negative values', () => {
    const result = minuteOfDayType(-1);
    expect(result instanceof type.errors).toBe(true);
  });

  it('should fail for values >= 1440', () => {
    const result = minuteOfDayType(1440);
    expect(result instanceof type.errors).toBe(true);
  });
});
