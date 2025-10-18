import { unixTimeNumberFromDateOrTimeNumber, type UnixDateTimeNumber, unixTimeNumberForNow, unixTimeNumberFromDate, dateFromDateOrTimeNumber, unixTimeNumberToDate } from '@dereekb/util';

describe('unixTimeNumberFromDateOrTimeNumber()', () => {
  const date = new Date('2023-01-01T00:00:05.500Z'); // 5.5 seconds into 2023-01-01 UTC
  const expectedUnixTime = Math.ceil(date.getTime() / 1000); // Equivalent to 1672531206

  it('should convert a Date object to a UnixDateTimeNumber', () => {
    const result = unixTimeNumberFromDateOrTimeNumber(date);
    expect(result).toBe(expectedUnixTime);
  });

  it('should return the same UnixDateTimeNumber if a number is passed', () => {
    const unixTime: UnixDateTimeNumber = 1672531200;
    const result = unixTimeNumberFromDateOrTimeNumber(unixTime);
    expect(result).toBe(unixTime);
  });

  it('should return null if null is passed', () => {
    const result = unixTimeNumberFromDateOrTimeNumber(null);
    expect(result).toBeNull();
  });

  it('should return undefined if undefined is passed', () => {
    const result = unixTimeNumberFromDateOrTimeNumber(undefined);
    expect(result).toBeUndefined();
  });

  it('should handle date with milliseconds by ceiling to the nearest second', () => {
    // Test with a date that has milliseconds to ensure Math.ceil is applied
    const dateWithMs = new Date('2023-10-26T10:20:30.123Z'); // 123 milliseconds
    const expectedTimeWithMs = Math.ceil(dateWithMs.getTime() / 1000);
    const result = unixTimeNumberFromDateOrTimeNumber(dateWithMs);
    expect(result).toBe(expectedTimeWithMs);

    const dateAtBoundaryMs = new Date('2023-10-26T10:20:30.999Z'); // 999 milliseconds
    const expectedTimeAtBoundaryMs = Math.ceil(dateAtBoundaryMs.getTime() / 1000);
    const resultAtBoundary = unixTimeNumberFromDateOrTimeNumber(dateAtBoundaryMs);
    expect(resultAtBoundary).toBe(expectedTimeAtBoundaryMs);

    const dateWithoutMs = new Date('2023-10-26T10:20:30.000Z'); // 0 milliseconds
    const expectedTimeWithoutMs = Math.ceil(dateWithoutMs.getTime() / 1000);
    const resultWithoutMs = unixTimeNumberFromDateOrTimeNumber(dateWithoutMs);
    expect(resultWithoutMs).toBe(expectedTimeWithoutMs);
  });
});

describe('unixTimeNumberForNow()', () => {
  it('should return a UnixDateTimeNumber (number)', () => {
    const result = unixTimeNumberForNow();
    expect(typeof result).toBe('number');
  });

  it('should return a timestamp close to the current time', () => {
    const result = unixTimeNumberForNow();
    const nowInSeconds = Math.ceil(Date.now() / 1000);
    // Allow a small difference (e.g., 1-2 seconds) to account for execution time between Date.now() and the function call.
    expect(result).toBeGreaterThanOrEqual(nowInSeconds - 2);
    expect(result).toBeLessThanOrEqual(nowInSeconds + 2);
  });
});

describe('unixTimeNumberFromDate()', () => {
  it('should convert a Date object to a UnixDateTimeNumber', () => {
    const date = new Date('2023-01-01T12:30:45.000Z');
    const expectedUnixTime = Math.ceil(date.getTime() / 1000);
    const result = unixTimeNumberFromDate(date);
    expect(result).toBe(expectedUnixTime);
    expect(result).toBe(1672576245); // 2023-01-01T12:30:45.000Z
  });

  it('should handle a Date object with milliseconds by ceiling to the nearest second', () => {
    const dateWithMs = new Date('2023-10-26T10:20:30.123Z');
    const expectedTimeWithMs = Math.ceil(dateWithMs.getTime() / 1000);
    const resultWithMs = unixTimeNumberFromDate(dateWithMs);
    expect(resultWithMs).toBe(expectedTimeWithMs);
    expect(resultWithMs).toBe(1698315631); // 2023-10-26T10:20:30.123Z -> 1698315631

    const dateAtBoundaryMs = new Date('2023-10-26T10:20:30.999Z');
    const expectedTimeAtBoundaryMs = Math.ceil(dateAtBoundaryMs.getTime() / 1000);
    const resultAtBoundary = unixTimeNumberFromDate(dateAtBoundaryMs);
    expect(resultAtBoundary).toBe(expectedTimeAtBoundaryMs);
    expect(resultAtBoundary).toBe(1698315631); // 2023-10-26T10:20:30.999Z -> 1698315631
  });

  it('should return null if null is passed', () => {
    const result = unixTimeNumberFromDate(null as any); // Cast to any to satisfy overload while testing MaybeNot path
    expect(result).toBeNull();
  });

  it('should return undefined if undefined is passed', () => {
    const result = unixTimeNumberFromDate(undefined as any); // Cast to any to satisfy overload while testing MaybeNot path
    expect(result).toBeUndefined();
  });
});

describe('dateFromDateOrTimeNumber()', () => {
  const baseDate = new Date('2023-01-01T12:00:00.000Z');
  const baseUnixTime: UnixDateTimeNumber = Math.floor(baseDate.getTime() / 1000); // 1672574400

  it('should return the same Date object if a Date is passed', () => {
    const result = dateFromDateOrTimeNumber(baseDate);
    expect(result).toBe(baseDate); // Should be the same instance
    expect(result?.getTime()).toBe(baseDate.getTime());
  });

  it('should convert a UnixDateTimeNumber to a Date object', () => {
    const result = dateFromDateOrTimeNumber(baseUnixTime);
    expect(result).toBeInstanceOf(Date);
    // The function unixTimeNumberToDate multiplies by 1000, so direct comparison of getTime()
    expect(result?.getTime()).toBe(baseUnixTime * 1000);
    expect(result?.toISOString()).toBe('2023-01-01T12:00:00.000Z');
  });

  it('should return null if null is passed', () => {
    const result = dateFromDateOrTimeNumber(null);
    expect(result).toBeNull();
  });

  it('should return undefined if undefined is passed', () => {
    const result = dateFromDateOrTimeNumber(undefined);
    expect(result).toBeUndefined();
  });

  it('should correctly convert a unix timestamp representing a date with milliseconds (timestamp will be seconds)', () => {
    // Date with milliseconds, unix timestamp is seconds (so milliseconds are lost in unixTime)
    const dateWithMs = new Date('2023-10-26T10:20:30.123Z');
    const unixTimeForDateWithMs = Math.floor(dateWithMs.getTime() / 1000); // 1698315630

    const result = dateFromDateOrTimeNumber(unixTimeForDateWithMs);
    expect(result).toBeInstanceOf(Date);
    expect(result?.getTime()).toBe(unixTimeForDateWithMs * 1000); // Back to milliseconds
    expect(result?.toISOString()).toBe('2023-10-26T10:20:30.000Z'); // Milliseconds are 000 when converted from Unix seconds
  });
});

describe('unixTimeNumberToDate()', () => {
  it('should convert a positive UnixDateTimeNumber to a Date object', () => {
    const unixTime: UnixDateTimeNumber = 1672531200; // 2023-01-01T00:00:00Z
    const result = unixTimeNumberToDate(unixTime);
    expect(result).toBeInstanceOf(Date);
    expect(result?.getTime()).toBe(unixTime * 1000);
    expect(result?.toISOString()).toBe('2023-01-01T00:00:00.000Z');
  });

  it('should convert 0 (Unix epoch) to a Date object representing 1970-01-01T00:00:00.000Z', () => {
    const unixTime: UnixDateTimeNumber = 0;
    const result = unixTimeNumberToDate(unixTime);
    expect(result).toBeInstanceOf(Date);
    expect(result?.getTime()).toBe(0);
    expect(result?.toISOString()).toBe('1970-01-01T00:00:00.000Z');
  });

  it('should convert a negative UnixDateTimeNumber (before epoch) to a Date object', () => {
    const unixTime: UnixDateTimeNumber = -86400; // One day before epoch: 1969-12-31T00:00:00Z
    const result = unixTimeNumberToDate(unixTime);
    expect(result).toBeInstanceOf(Date);
    expect(result?.getTime()).toBe(unixTime * 1000);
    expect(result?.toISOString()).toBe('1969-12-31T00:00:00.000Z');
  });

  it('should return null if null is passed', () => {
    const result = unixTimeNumberToDate(null);
    expect(result).toBeNull();
  });

  it('should return undefined if undefined is passed', () => {
    const result = unixTimeNumberToDate(undefined);
    expect(result).toBeUndefined();
  });
});
