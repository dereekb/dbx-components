import { minAndMaxFunction } from '@dereekb/util';

describe('minAndMaxFunction()', () => {
  describe('function', () => {
    const fn = minAndMaxFunction<number>((a, b) => a - b);

    it('should return undefined if no values are passed to the function.', () => {
      const result = fn([]);
      expect(result).toBe(null);
    });

    it('should return the min and max values', () => {
      const min = 0;
      const max = 5;
      const result = fn([min, 1, 2, 3, 4, max]);
      expect(result?.min).toBe(min);
      expect(result?.max).toBe(max);
    });
  });
});
