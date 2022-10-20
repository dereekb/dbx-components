import { readKeysFunction, readKeysSetFunction } from './key';

describe('readKeysFunction()', () => {
  describe('function', () => {
    it('should read the keys from the input values.', () => {
      const fn = readKeysFunction<string>((x) => x);
      const input = ['a', 'b', 'c', 'd'];

      const result = fn(input);
      expect(result.length).toBe(input.length);
      expect(result).toContain(input[0]);
      expect(result).toContain(input[1]);
      expect(result).toContain(input[2]);
      expect(result).toContain(input[3]);
    });
  });
});

describe('readKeysSetFunction()', () => {
  describe('function', () => {
    it('should read the keys from the input values.', () => {
      const fn = readKeysSetFunction<string>((x) => x);
      const input = ['a', 'b', 'c', 'd'];

      const result = fn(input);
      expect(result.size).toBe(input.length);
      expect(result).toContain(input[0]);
      expect(result).toContain(input[1]);
      expect(result).toContain(input[2]);
      expect(result).toContain(input[3]);
    });
  });
});
