import { type Getter } from '../getter/getter';
import { setsAreEquivalent } from '../set/set';
import { type Maybe } from '../value/maybe.type';
import { areEqualPOJOValues, objectFieldEqualityChecker } from './object.equal';

describe('areEqualPOJOValues()', () => {
  function describeTestsForDifferentValueComparisons<T>(type: string, makeValueA: Getter<T>, makeValueB: Getter<T>) {
    it(`should return false if both objects have equal but separate ${type}s in arrays.`, () => {
      const a = { a: [makeValueA(), makeValueA(), makeValueA()] };
      const b = { a: [makeValueA(), makeValueA(), makeValueB()] };

      expect(areEqualPOJOValues(a, b)).toBe(false);
    });

    it(`should return false if both objects have equal but separate ${type}s in nested arrays.`, () => {
      const a = { a: { a: { a: [makeValueA()] } } };
      const b = { a: { a: { a: [makeValueB()] } } };

      expect(areEqualPOJOValues(a, b)).toBe(false);
    });
  }

  function describeTestsForAllValueComparisons<T>(type: string, makeValueA: Getter<T>, makeValueB: Getter<T>) {
    it(`should return true if two ${type}s are equal but separate.`, () => {
      const a = makeValueA();
      const b = makeValueA();

      expect(areEqualPOJOValues(a, b)).toBe(true);
    });

    it(`should return true if both objects have equal but separate ${type}s.`, () => {
      const a = { a: makeValueA() };
      const b = { a: makeValueA() };

      expect(areEqualPOJOValues(a, b)).toBe(true);
    });

    it(`should return true if both objects have equal and same reference ${type}s.`, () => {
      const c = makeValueA();
      const a = { c };
      const b = { c };

      expect(areEqualPOJOValues(a, b)).toBe(true);
    });

    it(`should return true if both objects have equal but separate ${type}s in arrays.`, () => {
      const a = { a: [makeValueA(), makeValueA(), makeValueA()] };
      const b = { a: [makeValueA(), makeValueA(), makeValueA()] };

      expect(areEqualPOJOValues(a, b)).toBe(true);
    });

    it(`should return true if both objects have equal but separate ${type}s in nested arrays.`, () => {
      const a = { a: { a: { a: [makeValueA()] } } };
      const b = { a: { a: { a: [makeValueA()] } } };

      expect(areEqualPOJOValues(a, b)).toBe(true);
    });

    describeTestsForDifferentValueComparisons(type, makeValueA, makeValueB);
  }

  describe('nullish', () => {
    it('should return false if comparing a null and undefined.', () => {
      const a = null;
      const b = undefined;

      expect(areEqualPOJOValues(a as any, b as any)).toBe(false);
    });

    describe('null', () => {
      describeTestsForAllValueComparisons(
        'null',
        () => null,
        () => 0
      );
    });

    describe('undefined', () => {
      describeTestsForAllValueComparisons(
        'undefined',
        () => undefined,
        () => null
      );
    });
  });

  describe('primatives', () => {
    describe('number', () => {
      describeTestsForAllValueComparisons(
        'number',
        () => 0,
        () => 1
      );
    });

    describe('string', () => {
      describeTestsForAllValueComparisons(
        'string',
        () => 'a',
        () => 'b'
      );
    });
  });

  describe('collections', () => {
    describe('Array', () => {
      describeTestsForAllValueComparisons(
        'array',
        () => ['a'],
        () => ['b']
      );
    });

    describe('Set', () => {
      describe('same size', () => {
        describeTestsForAllValueComparisons(
          'set',
          () => new Set('a'),
          () => new Set('b')
        );
      });

      describe('different size', () => {
        describeTestsForDifferentValueComparisons(
          'set',
          () => new Set('a'),
          () => new Set(['a', 'b', 'c'])
        );
      });
    });

    describe('Map', () => {
      describeTestsForAllValueComparisons(
        'map',
        () => new Map<string, string>([['a', 'b']]),
        () => new Map<string, string>([['a', 'c']])
      );
    });
  });

  describe('object', () => {
    describeTestsForAllValueComparisons(
      'object',
      () => ({ a: 0 }),
      () => ({ a: 1 })
    );

    it('should return false if both objects have the same properties but are not equal.', () => {
      const a = { a: 'a' };
      const b = { a: 'b' };

      expect(areEqualPOJOValues(a as any, b as any)).toBe(false);
    });
  });

  describe('Date', () => {
    describeTestsForAllValueComparisons(
      'date',
      () => new Date(0),
      () => new Date(1)
    );
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
