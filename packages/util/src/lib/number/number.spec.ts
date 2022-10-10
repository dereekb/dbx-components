import { nearestDivisibleValues, sumOfIntegersBetween } from './number';

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
