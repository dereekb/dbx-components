import { cutToPrecision, cutValueToPrecision, numberFactorConverter, roundToPrecision, roundToPrecisionFunction } from './round';

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

  it('should cut an exponent-form value', () => {
    expect(cutToPrecision(1e-7, 2)).toBe(0);
  });
});

describe('roundToPrecision()', () => {
  it('should round to the precision', () => {
    expect(roundToPrecision(1.234, 2)).toBe(1.23);
    expect(roundToPrecision(1.235, 2)).toBe(1.24);
  });

  it('should round exact decimal halves correctly', () => {
    expect(roundToPrecision(1.005, 2)).toBe(1.01);
    expect(roundToPrecision(-1.005, 2)).toBe(-1);
    expect(roundToPrecision(-2.5, 0)).toBe(-2);
  });

  it('should round exponent-form values', () => {
    expect(roundToPrecision(1e-7, 2)).toBe(0);
    expect(roundToPrecision(5e21, 2)).toBe(5e21);
    expect(roundToPrecision(1.5e-7, 7)).toBe(2e-7);
  });

  it('should return non-finite values unchanged', () => {
    expect(roundToPrecision(Infinity, 2)).toBe(Infinity);
    expect(roundToPrecision(-Infinity, 2)).toBe(-Infinity);
    expect(roundToPrecision(Number.NaN, 2)).toBeNaN();
  });

  it('should support a negative precision', () => {
    expect(roundToPrecision(1234, -2)).toBe(1200);
  });
});

describe('roundToPrecisionFunction()', () => {
  it('should ceil an exponent-form value', () => {
    expect(roundToPrecisionFunction(2, 'ceil')(1e-7)).toBe(0.01);
  });

  it('should floor to the precision', () => {
    expect(roundToPrecisionFunction(1, 'floor')(1.29)).toBe(1.2);
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
      const value = 5.555555555555555;

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

describe('numberFactorConverter()', () => {
  it('should throw if the factor is zero', () => {
    expect(() => numberFactorConverter(0)).toThrow();
  });

  describe('function', () => {
    const converter = numberFactorConverter(15);

    it('should default to floor rounding', () => {
      expect(converter.rounding).toBe('floor');
    });

    describe('reduce()', () => {
      it('should divide the value by the factor', () => {
        expect(converter.reduce(45)).toBe(3);
      });

      it('should round the reduced value', () => {
        expect(converter.reduce(50)).toBe(3);
      });
    });

    describe('expand()', () => {
      it('should multiply the value by the factor', () => {
        expect(converter.expand(3)).toBe(45);
      });
    });

    describe('round()', () => {
      it('should round the value to a multiple of the factor', () => {
        expect(converter.round(50)).toBe(45);
      });

      it('should not change a multiple of the factor', () => {
        expect(converter.round(45)).toBe(45);
      });
    });
  });

  describe('config', () => {
    it('should use the configured rounding', () => {
      const converter = numberFactorConverter({ factor: 15, round: 'ceil' });
      expect(converter.reduce(50)).toBe(4);
      expect(converter.round(50)).toBe(60);
    });

    it('should not round when rounding is none', () => {
      const converter = numberFactorConverter({ factor: 100, round: 'none' });
      expect(converter.reduce(150)).toBe(1.5);
      expect(converter.round(150)).toBe(150);
    });
  });
});
