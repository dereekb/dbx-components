import { asFiniteNumber, nearestDivisibleValues, sumOfIntegersBetween, getBaseLog } from './number';

describe('nearestDivisibleValues', () => {
  it('should return the nearest divisible values to 3', () => {
    const result = nearestDivisibleValues(1, 3);

    expect(result.value).toBe(1);
    expect(result.divisor).toBe(3);
    expect(result.nearestFloor).toBe(0);
    expect(result.nearestCeil).toBe(3);
  });
});

describe('sumOfIntegersBetween()', () => {
  it('should calculate the sum of 1 to 1.', () => {
    const result = sumOfIntegersBetween(1, 1);
    expect(result).toBe(1);
  });

  it('should calculate the sum of 3 to 6.', () => {
    const result = sumOfIntegersBetween(3, 6);
    expect(result).toBe(18);
  });

  it('should calculate the sum of 51 to 100.', () => {
    const result = sumOfIntegersBetween(51, 100);
    expect(result).toBe(3775);
  });
});

describe('getBaseLog()', () => {
  it('should run the example successfully', () => {
    expect(getBaseLog(2, 16)).toBe(4);
    expect(getBaseLog(10, 100)).toBe(2);
  });
});

describe('asFiniteNumber()', () => {
  it('passes a finite number and parses a numeric string', () => {
    expect(asFiniteNumber(0.0031)).toBe(0.0031);
    expect(asFiniteNumber(0)).toBe(0);
    expect(asFiniteNumber(-0.25)).toBe(-0.25);
    expect(asFiniteNumber('0.00065716')).toBe(0.00065716);
    expect(asFiniteNumber(' 0.5 ')).toBe(0.5);
    expect(asFiniteNumber('1e3')).toBe(1000);
  });

  it('reads anything else as ABSENT, never as a made-up 0', () => {
    expect(asFiniteNumber(undefined)).toBeUndefined();
    expect(asFiniteNumber(null)).toBeUndefined();
    expect(asFiniteNumber('')).toBeUndefined();
    expect(asFiniteNumber('   ')).toBeUndefined();
    expect(asFiniteNumber('n/a')).toBeUndefined();
    expect(asFiniteNumber('Infinity')).toBeUndefined();
    expect(asFiniteNumber(Number.NaN)).toBeUndefined();
    expect(asFiniteNumber(Number.POSITIVE_INFINITY)).toBeUndefined();
    expect(asFiniteNumber({ amount: 1 })).toBeUndefined();
  });
});
