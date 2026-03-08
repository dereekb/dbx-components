import { randomNumberFactory, randomNumber } from './random';

describe('randomNumberFactory()', () => {
  it('should create a factory', () => {
    const factory = randomNumberFactory(100);
    expect(factory).toBeDefined();
  });

  describe('with max only', () => {
    it('should generate numbers between 0 and max', () => {
      const factory = randomNumberFactory(10);

      for (let i = 0; i < 50; i++) {
        const value = factory();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(10);
      }
    });
  });

  describe('with min and max', () => {
    it('should generate numbers within the configured range', () => {
      const factory = randomNumberFactory({ min: 5, max: 10 });

      for (let i = 0; i < 50; i++) {
        const value = factory();
        expect(value).toBeGreaterThanOrEqual(5);
        expect(value).toBeLessThan(10);
      }
    });
  });

  describe('with rounding', () => {
    it('should produce integer values when using floor rounding', () => {
      const factory = randomNumberFactory(100, 'floor');

      for (let i = 0; i < 50; i++) {
        const value = factory();
        expect(Number.isInteger(value)).toBe(true);
      }
    });

    it('should accept rounding in config object', () => {
      const factory = randomNumberFactory({ max: 100, round: 'ceil' });

      for (let i = 0; i < 50; i++) {
        const value = factory();
        expect(Number.isInteger(value)).toBe(true);
      }
    });
  });
});

describe('randomNumber()', () => {
  it('should return a single random number', () => {
    const value = randomNumber(100);
    expect(typeof value).toBe('number');
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(100);
  });
});
