import { NumberBound, isInNumberBoundFunction, wrapNumberFunction } from './bound';

describe('isInBoundFunction()', () => {
  describe('function', () => {
    function testForBounds(bounds: NumberBound) {
      const fn = isInNumberBoundFunction(bounds);

      it('should return true if it is the minimum.', () => {
        expect(fn(bounds.min)).toBe(true);
      });

      it('should return true if it is the maximum.', () => {
        expect(fn(bounds.max)).toBe(true);
      });

      it('should return false if it is less than the minimum.', () => {
        expect(fn(bounds.min - 1)).toBe(false);
      });

      it('should return true if it is greater than the maximum.', () => {
        expect(fn(bounds.max + 1)).toBe(false);
      });
    }

    describe('pos,pos', () => {
      testForBounds({ min: 5, max: 10 });
    });

    describe('neg,pos', () => {
      testForBounds({ min: -5, max: 5 });
    });

    describe('neg,neg', () => {
      testForBounds({ min: -10, max: -5 });
    });
  });
});

describe('wrapNumberFunction()', () => {
  describe('function', () => {
    describe('neg,pos', () => {
      const bounds: NumberBound = { min: -100, max: 100 };
      const wrapFn = wrapNumberFunction(bounds);

      it('should wrap a negative value to the other side.', () => {
        const input = -190;
        expect(wrapFn(input)).toBe(10);
      });

      it('should wrap a positive value to the other side.', () => {
        const input = 190;
        expect(wrapFn(input)).toBe(-10);
      });
    });
  });
});