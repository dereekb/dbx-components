import { setsAreEquivalent } from '../set/set';
import { Maybe } from '../value/maybe.type';
import { areEqualPOJOValues, objectFieldEqualityChecker } from './object.equal';

describe('areEqualObjectValues', () => {
  it('should return true if both objects are equal.', () => {
    const a = { a: 'a' };
    const b = { a: 'a' };

    expect(areEqualPOJOValues(a, b)).toBe(true);
  });

  it('should return false if both objects have the same properties but are not equal.', () => {
    const a = { a: 'a' };
    const b = { a: 'b' };

    expect(areEqualPOJOValues(a as any, b as any)).toBe(false);
  });

  it('should return false if both objects are not equal.', () => {
    const a = { a: 'a' };
    const b = { b: 'a' };

    expect(areEqualPOJOValues(a as any, b as any)).toBe(false);
  });
});

interface SimpleType {
  str: string;
  num: number;
}

interface ComplexType extends SimpleType {
  set?: Maybe<Set<number>>;
}

describe('objectFieldEqualityChecker()', () => {
  describe('function', () => {
    describe('simple', () => {
      const fn = objectFieldEqualityChecker<SimpleType>({
        fields: ['str', 'num']
      });

      it('should return true if both objects are equal.', () => {
        const a = { str: 'a', num: 1 };

        const result = fn(a, a);
        expect(result.equalFields.length).toBe(2);
        expect(result.unequalFields.length).toBe(0);
        expect(result.isEqual).toBe(true);
      });

      it('should return false if the objects are not equal.', () => {
        const a = { str: 'a', num: 1 };
        const b = { str: 'a', num: 2 };

        const result = fn(a, b);
        expect(result.equalFields.length).toBe(1);
        expect(result.unequalFields.length).toBe(1);
        expect(result.isEqual).toBe(false);

        expect(result.equalFields).toContain('str');
        expect(result.unequalFields).toContain('num');
      });
    });

    describe('complex', () => {
      const fn = objectFieldEqualityChecker<ComplexType>({
        fields: ['str', 'num', { fieldName: 'set', isEqual: setsAreEquivalent }]
      });

      it('should return true if both objects are equal.', () => {
        const a = { str: 'a', num: 1, set: new Set([1, 2, 3]) };
        const b = { str: 'a', num: 1, set: new Set([1, 2, 3]) };

        const result = fn(a, a);
        expect(result.equalFields.length).toBe(3);
        expect(result.unequalFields.length).toBe(0);
        expect(result.isEqual).toBe(true);
      });

      it('should return false if both objects are equal.', () => {
        const a = { str: 'a', num: 1, set: new Set([1, 2, 3]) };
        const b = { str: 'a', num: 1, set: new Set([4]) };

        const result = fn(a, b);
        expect(result.equalFields.length).toBe(2);
        expect(result.unequalFields.length).toBe(1);
        expect(result.isEqual).toBe(false);

        expect(result.equalFields).toContain('str');
        expect(result.unequalFields).toContain('set');
      });
    });
  });
});
