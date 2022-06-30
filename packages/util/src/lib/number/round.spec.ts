import { cutToPrecision, cutValueToPrecision } from './round';

describe('cutToPrecision', () => {
  it('should not round to the nearest value.', () => {
    const value = 1.25;
    const precision = 1;

    expect(cutToPrecision(value, precision)).toBe(1.2);
  });

  it('cut to the specified precision', () => {
    const expectedValue = 1.23429;
    const precision = 5;
    const value = expectedValue + Math.random() * Math.pow(10, -precision);

    const result = cutToPrecision(value, precision);

    expect(value).toBeGreaterThanOrEqual(expectedValue);
    expect(result).toBe(expectedValue);
  });
});

describe('cutValueToPrecision', () => {
  it('should not round to the nearest value.', () => {
    const value = 1.25;
    const precision = 1;

    expect(cutValueToPrecision(value, precision)).toBe(1.2);
  });

  it('cut to the specified precision (positive value)', () => {
    const expectedValue = 1.23429;
    const precision = 5;
    const value = expectedValue + Math.random() * Math.pow(10, -precision);

    const result = cutValueToPrecision(value, precision);

    expect(value).toBeGreaterThanOrEqual(expectedValue);
    expect(result).toBe(expectedValue);
  });

  it('cut to the specified precision (negative value)', () => {
    const expectedValue = -1.23429;
    const precision = 5;
    const value = expectedValue - Math.random() * Math.pow(10, -precision);

    const result = cutValueToPrecision(value, precision);

    expect(value).toBeLessThanOrEqual(expectedValue);
    expect(result).toBe(expectedValue);
  });

  describe('other use cases', () => {
    it('cutting to zero', () => {
      const expectedValue = 0;
      const precision = 3;
      const value = 0.0001;

      const result = cutValueToPrecision(value, precision);

      expect(result).toBe(expectedValue);
    });

    it('cutting repeating value', () => {
      const expectedValue = 5.555;
      const precision = 3;
      const value = 5.5555555555555555555555;

      const result = cutValueToPrecision(value, precision);

      expect(result).toBe(expectedValue);
    });

    it('scenario A', () => {
      const expectedValue = -96.383;
      const precision = 3;
      const value = -96.38315;

      const result = cutValueToPrecision(value, precision);

      expect(result).toBe(expectedValue);
    });
  });
});
