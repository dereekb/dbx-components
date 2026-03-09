import { dateFromLogicalDate, isLogicalDateStringCode, DATE_NOW_VALUE } from './date.time';

describe('dateFromLogicalDate', () => {
  it('should return a Date when given a Date', () => {
    const date = new Date('2023-01-15T00:00:00.000Z');
    const result = dateFromLogicalDate(date);
    expect(result).toBe(date);
  });

  it('should return a Date for "now"', () => {
    const before = Date.now();
    const result = dateFromLogicalDate(DATE_NOW_VALUE);
    const after = Date.now();

    expect(result).toBeInstanceOf(Date);
    expect(result.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.getTime()).toBeLessThanOrEqual(after);
  });

  it('should handle "now" case-insensitively', () => {
    const result = dateFromLogicalDate('Now' as any);
    expect(result).toBeInstanceOf(Date);
  });

  it('should return null/undefined for null/undefined input', () => {
    expect(dateFromLogicalDate(null as any)).toBeNull();
    expect(dateFromLogicalDate(undefined as any)).toBeUndefined();
  });

  it('should throw for an unknown logical date string', () => {
    expect(() => dateFromLogicalDate('unknown' as any)).toThrow();
  });
});

describe('isLogicalDateStringCode', () => {
  it('should return true for "now"', () => {
    expect(isLogicalDateStringCode(DATE_NOW_VALUE)).toBe(true);
  });

  it('should return true for "Now" (case-insensitive)', () => {
    expect(isLogicalDateStringCode('Now')).toBe(true);
  });

  it('should return false for an unknown string', () => {
    expect(isLogicalDateStringCode('unknown')).toBe(false);
  });

  it('should return false for null', () => {
    expect(isLogicalDateStringCode(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isLogicalDateStringCode(undefined)).toBe(false);
  });

  it('should return false for a Date object', () => {
    expect(isLogicalDateStringCode(new Date() as any)).toBe(false);
  });
});
