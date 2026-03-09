import { iterablesAreSetEquivalent } from '../set/set';
import { compareEqualityWithValueFromItemsFunctionFactory, safeCompareEquality, safeEqualityComparatorFunction } from './comparator';

describe('safeEqualityComparatorFunction()', () => {
  it('should compare values when both are non-null', () => {
    const safeCompare = safeEqualityComparatorFunction((a: number, b: number) => a === b);
    expect(safeCompare(1, 1)).toBe(true);
  });

  it('should return true when both values are null', () => {
    const safeCompare = safeEqualityComparatorFunction((a: number, b: number) => a === b);
    expect(safeCompare(null, null)).toBe(true);
  });

  it('should return false when null is compared to undefined', () => {
    const safeCompare = safeEqualityComparatorFunction((a: number, b: number) => a === b);
    expect(safeCompare(null, undefined)).toBe(false);
  });
});

describe('safeCompareEquality()', () => {
  it('should compare the values if they are both non-null', () => {
    let compared = false;

    const result = safeCompareEquality(0, 1, () => {
      compared = true;
      return false;
    });

    expect(compared).toBe(true);
    expect(result).toBe(false);
  });

  it('should not compare the values if they are both null', () => {
    let compared = false;

    const result = safeCompareEquality(null, null, () => {
      compared = true;
      return false;
    });

    expect(compared).toBe(false);
    expect(result).toBe(true);
  });

  it('should not compare the values if they are both null or undefined', () => {
    let compared = false;

    const result = safeCompareEquality(null, undefined, () => {
      compared = true;
      return false;
    });

    expect(compared).toBe(false);
    expect(result).toBe(false); // undefined is not equal to null
  });
});

describe('compareEqualityWithValueFromItemsFunctionFactory()', () => {
  describe('function', () => {
    const factory = compareEqualityWithValueFromItemsFunctionFactory<number, number[]>((x) => [x]);

    it('should create a new CompareEqualityWithValueFromItemsFunctionFactory from the input comparison function.', () => {
      const equalityComparator = iterablesAreSetEquivalent;
      const result = factory(equalityComparator);

      expect(result._readValues).toBe(factory._readValues);
      expect(result._equalityComparator).toBe(equalityComparator);
    });

    describe('function', () => {
      const fn = factory(iterablesAreSetEquivalent);

      it('should decide true if the two inputs are undefined.', () => {
        const result = fn(undefined, undefined);
        expect(result).toBe(true);
      });

      it('should decide true if the two inputs are null.', () => {
        const result = fn(null, null);
        expect(result).toBe(true);
      });

      it('should return true if the two inputs match the decision function.', () => {
        const result = fn(0, 0);
        expect(result).toBe(true);
      });

      it('should return false if the two inputs do not match the decision function.', () => {
        const result = fn(0, 1);
        expect(result).toBe(false);
      });
    });
  });
});
