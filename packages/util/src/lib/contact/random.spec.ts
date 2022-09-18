import { isEmail } from 'class-validator';
import { randomEmailFactory } from './random';

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
