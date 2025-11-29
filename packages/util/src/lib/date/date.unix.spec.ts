import { unixDateTimeSecondsNumberFromDateOrTimeNumber, unixDateTimeSecondsNumberForNow, unixDateTimeSecondsNumberFromDate, unixDateTimeSecondsNumberToDate, dateFromDateOrTimeSecondsNumber, UnixDateTimeSecondsNumber } from '@dereekb/util';

describe('unixDateTimeSecondsNumberFromDateOrTimeNumber()', () => {
  const date = new Date('2023-01-01T00:00:05.500Z'); // 5.5 seconds into 2023-01-01 UTC
  const expectedUnixTime: UnixDateTimeSecondsNumber = Math.ceil(date.getTime() / 1000); // Equivalent to 1672531206

  it('should convert a Date object to a UnixDateTimeSecondsNumber', () => {
    const result = unixDateTimeSecondsNumberFromDateOrTimeNumber(date);
    expect(result).toBe(expectedUnixTime);
  });

  it('should return the same UnixDateTimeSecondsNumber if a number is passed', () => {
    const unixTime: UnixDateTimeSecondsNumber = 1672531200;
    const result = unixDateTimeSecondsNumberFromDateOrTimeNumber(unixTime);
    expect(result).toBe(unixTime);
  });

  it('should return null if null is passed', () => {
    const result = unixDateTimeSecondsNumberFromDateOrTimeNumber(null);
    expect(result).toBeNull();
  });

  it('should return undefined if undefined is passed', () => {
    const result = unixDateTimeSecondsNumberFromDateOrTimeNumber(undefined);
    expect(result).toBeUndefined();
  });

  it('should handle date with milliseconds by ceiling to the nearest second', () => {
    // Test with a date that has milliseconds to ensure Math.ceil is applied
    const dateWithMs = new Date('2023-10-26T10:20:30.123Z'); // 123 milliseconds
    const expectedTimeWithMs: UnixDateTimeSecondsNumber = Math.ceil(dateWithMs.getTime() / 1000);
    const result = unixDateTimeSecondsNumberFromDateOrTimeNumber(dateWithMs);
    expect(result).toBe(expectedTimeWithMs);

    const dateAtBoundaryMs = new Date('2023-10-26T10:20:30.999Z'); // 999 milliseconds
    const expectedTimeAtBoundaryMs: UnixDateTimeSecondsNumber = Math.ceil(dateAtBoundaryMs.getTime() / 1000);
    const resultAtBoundary = unixDateTimeSecondsNumberFromDateOrTimeNumber(dateAtBoundaryMs);
    expect(resultAtBoundary).toBe(expectedTimeAtBoundaryMs);

    const dateWithoutMs = new Date('2023-10-26T10:20:30.000Z'); // 0 milliseconds
    const expectedTimeWithoutMs = Math.ceil(dateWithoutMs.getTime() / 1000);
    const resultWithoutMs = unixDateTimeSecondsNumberFromDateOrTimeNumber(dateWithoutMs);
    expect(resultWithoutMs).toBe(expectedTimeWithoutMs);
  });
});

describe('unixDateTimeSecondsNumberForNow()', () => {
  it('should return a UnixDateTimeSecondsNumber (number)', () => {
    const result = unixDateTimeSecondsNumberForNow();
    expect(typeof result).toBe('number');
  });

  it('should return a timestamp close to the current time', () => {
    const result = unixDateTimeSecondsNumberForNow();
    const nowInSeconds = Math.ceil(Date.now() / 1000);
    // Allow a small difference (e.g., 1-2 seconds) to account for execution time between Date.now() and the function call.
    expect(result).toBeGreaterThanOrEqual(nowInSeconds - 2);
    expect(result).toBeLessThanOrEqual(nowInSeconds + 2);
  });
});

describe('unixDateTimeSecondsNumberFromDate()', () => {
  it('should convert a Date object to a UnixDateTimeSecondsNumber', () => {
    const date = new Date('2023-01-01T12:30:45.000Z');
    const expectedUnixTime: UnixDateTimeSecondsNumber = Math.ceil(date.getTime() / 1000);
    const result = unixDateTimeSecondsNumberFromDate(date);
    expect(result).toBe(expectedUnixTime);
    expect(result).toBe(1672576245); // 2023-01-01T12:30:45.000Z
  });

  it('should handle a Date object with milliseconds by ceiling to the nearest second', () => {
    const dateWithMs = new Date('2023-10-26T10:20:30.123Z');
    const expectedTimeWithMs: UnixDateTimeSecondsNumber = Math.ceil(dateWithMs.getTime() / 1000);
    const resultWithMs = unixDateTimeSecondsNumberFromDate(dateWithMs);
    expect(resultWithMs).toBe(expectedTimeWithMs);
    expect(resultWithMs).toBe(1698315631); // 2023-10-26T10:20:30.123Z -> 1698315631

    const dateAtBoundaryMs = new Date('2023-10-26T10:20:30.999Z');
    const expectedTimeAtBoundaryMs: UnixDateTimeSecondsNumber = Math.ceil(dateAtBoundaryMs.getTime() / 1000);
    const resultAtBoundary = unixDateTimeSecondsNumberFromDate(dateAtBoundaryMs);
    expect(resultAtBoundary).toBe(expectedTimeAtBoundaryMs);
    expect(resultAtBoundary).toBe(1698315631); // 2023-10-26T10:20:30.999Z -> 1698315631
  });

  it('should return null if null is passed', () => {
    const result = unixDateTimeSecondsNumberFromDate(null as any); // Cast to any to satisfy overload while testing MaybeNot path
    expect(result).toBeNull();
  });

  it('should return undefined if undefined is passed', () => {
    const result = unixDateTimeSecondsNumberFromDate(undefined as any); // Cast to any to satisfy overload while testing MaybeNot path
    expect(result).toBeUndefined();
  });
});

describe('dateFromDateOrTimeSecondsNumber()', () => {
  const baseDate = new Date('2023-01-01T12:00:00.000Z');
  const baseUnixTime: UnixDateTimeSecondsNumber = Math.floor(baseDate.getTime() / 1000); // 1672574400

  it('should return the same Date object if a Date is passed', () => {
    const result = dateFromDateOrTimeSecondsNumber(baseDate);
    expect(result).toBe(baseDate); // Should be the same instance
    expect(result?.getTime()).toBe(baseDate.getTime());
  });

  it('should convert a UnixDateTimeSecondsNumber to a Date object', () => {
    const result = dateFromDateOrTimeSecondsNumber(baseUnixTime);
    expect(result).toBeInstanceOf(Date);
    // The function unixDateTimeSecondsNumberToDate multiplies by 1000, so direct comparison of getTime()
    expect(result?.getTime()).toBe(baseUnixTime * 1000);
    expect(result?.toISOString()).toBe('2023-01-01T12:00:00.000Z');
  });

  it('should return null if null is passed', () => {
    const result = dateFromDateOrTimeSecondsNumber(null);
    expect(result).toBeNull();
  });

  it('should return undefined if undefined is passed', () => {
    const result = dateFromDateOrTimeSecondsNumber(undefined);
    expect(result).toBeUndefined();
  });

  it('should correctly convert a unix timestamp representing a date with milliseconds (timestamp will be seconds)', () => {
    // Date with milliseconds, unix timestamp is seconds (so milliseconds are lost in unixTime)
    const dateWithMs = new Date('2023-10-26T10:20:30.123Z');
    const unixTimeForDateWithMs = Math.floor(dateWithMs.getTime() / 1000); // 1698315630

    const result = dateFromDateOrTimeSecondsNumber(unixTimeForDateWithMs);
    expect(result).toBeInstanceOf(Date);
    expect(result?.getTime()).toBe(unixTimeForDateWithMs * 1000); // Back to milliseconds
    expect(result?.toISOString()).toBe('2023-10-26T10:20:30.000Z'); // Milliseconds are 000 when converted from Unix seconds
  });
});

describe('unixDateTimeSecondsNumberToDate()', () => {
  it('should convert a positive UnixDateTimeSecondsNumber to a Date object', () => {
    const unixTime: UnixDateTimeSecondsNumber = 1672531200; // 2023-01-01T00:00:00Z
    const result = unixDateTimeSecondsNumberToDate(unixTime);
    expect(result).toBeInstanceOf(Date);
    expect(result?.getTime()).toBe(unixTime * 1000);
    expect(result?.toISOString()).toBe('2023-01-01T00:00:00.000Z');
  });

  it('should convert 0 (Unix epoch) to a Date object representing 1970-01-01T00:00:00.000Z', () => {
    const unixTime: UnixDateTimeSecondsNumber = 0;
    const result = unixDateTimeSecondsNumberToDate(unixTime);
    expect(result).toBeInstanceOf(Date);
    expect(result?.getTime()).toBe(0);
    expect(result?.toISOString()).toBe('1970-01-01T00:00:00.000Z');
  });

  it('should convert a negative UnixDateTimeSecondsNumber (before epoch) to a Date object', () => {
    const unixTime: UnixDateTimeSecondsNumber = -86400; // One day before epoch: 1969-12-31T00:00:00Z
    const result = unixDateTimeSecondsNumberToDate(unixTime);
    expect(result).toBeInstanceOf(Date);
    expect(result?.getTime()).toBe(unixTime * 1000);
    expect(result?.toISOString()).toBe('1969-12-31T00:00:00.000Z');
  });

  it('should return null if null is passed', () => {
    const result = unixDateTimeSecondsNumberToDate(null);
    expect(result).toBeNull();
  });

  it('should return undefined if undefined is passed', () => {
    const result = unixDateTimeSecondsNumberToDate(undefined);
    expect(result).toBeUndefined();
  });
});
