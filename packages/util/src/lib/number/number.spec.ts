import { nearestDivisibleValues } from './number';

describe('nearestDivisibleValues', () => {
  it('should return the nearest divisible values to 3', () => {
    const result = nearestDivisibleValues(1, 3);

    expect(result.value).toBe(1);
    expect(result.divisor).toBe(3);
    expect(result.nearestFloor).toBe(0);
    expect(result.nearestCeil).toBe(3);
  });
});
