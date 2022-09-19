import { isEmail, isPhoneNumber } from 'class-validator';
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
      expect(isEmail(result)).toBe(true);
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
      expect(isPhoneNumber(result)).toBe(true);
    });
  });
});
