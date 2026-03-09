import { isE164PhoneNumber } from './phone';
import { randomEmailFactory, randomPhoneNumberFactory } from './random';

describe('randomEmailFactory()', () => {
  describe('function', () => {
    const factory = randomEmailFactory({
      domains: ['a.com', 'b.com', 'c.com'],
      prefixes: ['hello', 'test']
    });

    it('should generate a valid email address.', () => {
      const result = factory();

      expect(result).toBeDefined();
      expect(result).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    });
  });
});

describe('randomPhoneNumberFactory()', () => {
  describe('function', () => {
    const factory = randomPhoneNumberFactory({
      internationalAreaCodes: [1210]
    });

    it('should generate a valid phone number.', () => {
      const result = factory();
      expect(result).toBeDefined();
      expect(isE164PhoneNumber(result)).toBe(true);
    });
  });
});
