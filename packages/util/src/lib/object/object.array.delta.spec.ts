import { setsAreEquivalent } from '../set/set';
import { Maybe } from '../value/maybe.type';
import { objectFieldEqualityChecker } from './object.equal';
import { objectDeltaArrayCompressor } from './object.array.delta';
import { objectHasKey, objectHasNoKeys } from './object';
import { IndexRef } from '../value';
import { range } from '../array/array.number';

interface SimpleType {
  str: string;
  num: number;
}

interface ComplexType extends SimpleType, IndexRef {
  set?: Maybe<Set<number>>;
  notKnownToCompressor?: string;
}

describe('objectDeltaArrayCompressor()', () => {
  describe('function', () => {
    describe('simple', () => {
      const equalityChecker = objectFieldEqualityChecker<SimpleType>({
        fields: ['str', 'num']
      });

      const compressor = objectDeltaArrayCompressor<SimpleType>({ equalityChecker });

      it('should return a compressed array of values.', () => {
        const a: SimpleType = { str: 'a', num: 1 };

        const input = [a, a, a];
        const result = compressor.compress(input);
        expect(result.length).toBe(input.length);
        expect(result[0].num).toBe(a.num);
        expect(result[0].str).toBe(a.str);
        expect(objectHasNoKeys(result[1])).toBe(true);
        expect(objectHasNoKeys(result[2])).toBe(true);
      });

      it('should decompress a compressed array of values.', () => {
        const a: SimpleType = { str: 'a', num: 1 };

        const input = [a, a, a];
        const compressResult = compressor.compress(input);
        const result = compressor.expand(compressResult);

        expect(result.length).toBe(input.length);

        range(input.length).forEach((i) => {
          expect(result[i].num).toBe(a.num);
          expect(result[i].str).toBe(a.str);
        });
      });
    });

    describe('complex', () => {
      const equalityChecker = objectFieldEqualityChecker<ComplexType>({
        fields: ['i', 'str', 'num', { fieldName: 'set', isEqual: setsAreEquivalent }]
      });

      const compressor = objectDeltaArrayCompressor<ComplexType>({ equalityChecker });

      it('should compress an empty array to an empty array', () => {
        const input: ComplexType[] = [];
        const result = compressor.compress(input);
        expect(result.length).toBe(0);
      });

      it('should expand an empty array to an empty array', () => {
        const result = compressor.expand([]);
        expect(result.length).toBe(0);
      });

      it('should encode null values to be undefined', () => {
        const a: ComplexType = { i: 0, str: 'a', num: 1, set: null };
        const b: ComplexType = { i: 1, str: 'a', num: 2 };

        const input = [a, b];
        const result = compressor.compress(input);
        expect(result.length).toBe(input.length);
        expect(objectHasKey(result[0], 'set')).toBe(false); // not set/ignored as undefined
        expect(objectHasKey(result[1], 'set')).toBe(false);
      });

      it('should set null on the compressed value for values that are cleared/undefined', () => {
        const a: ComplexType = { i: 0, str: 'a', num: 1, set: new Set([1, 2, 3]) };
        const b: ComplexType = { i: 1, str: 'a', num: 2, notKnownToCompressor: 'removed' };

        const input = [a, b];
        const result = compressor.compress(input);
        expect(result.length).toBe(input.length);
        expect(result[1].set).toBe(null); // set is cleared
      });

      it('should omit values that are not defined, and add them when they become defined', () => {
        const a: ComplexType = { i: 0, str: 'a', num: 1 };
        const b: ComplexType = { i: 1, str: 'a', num: 2 };
        const c: ComplexType = { i: 2, str: 'b', num: 2, set: new Set([1, 2, 3]) };

        const input = [a, b, c];
        const result = compressor.compress(input);
        expect(result.length).toBe(input.length);
        expect(objectHasKey(result[0], 'set')).toBe(false);
        expect(objectHasKey(result[1], 'set')).toBe(false);
        expect(objectHasKey(result[2], 'set')).toBe(true);
        expect(result[2].set).toBe(c.set);
      });

      it('should ignore values that are not known to the compressor.', () => {
        const a: ComplexType = { i: 0, str: 'a', num: 1, set: new Set([1, 2, 3]), notKnownToCompressor: 'removed' };
        const c: ComplexType = { i: 2, str: 'b', num: 2 };

        const input = [a, c];
        const result = compressor.compress(input);
        expect(result.length).toBe(input.length);
        expect(objectHasKey(result[0], 'notKnownToCompressor')).toBe(false); // values not known to compressor are ignored
      });

      it('should return a compressed array of values.', () => {
        const a: ComplexType = { i: 0, str: 'a', num: 1, set: new Set([1, 2, 3]) };
        const b: ComplexType = { i: 1, str: 'a', num: 2, notKnownToCompressor: 'removed' };
        const c: ComplexType = { i: 2, str: 'b', num: 2 };

        const input = [a, b, c];
        const result = compressor.compress(input);
        expect(result.length).toBe(input.length);
        expect(result[0].num).toBe(a.num);
        expect(result[0].str).toBe(a.str);
        expect(result[0].i).toBe(a.i);
        expect(result[1].i).toBe(b.i);
        expect(result[2].i).toBe(c.i);

        expect(objectHasKey(result[1], 'notKnownToCompressor')).toBe(false); // values not known to compressor are ignored

        // check set is cleared with null
        expect(result[1].set).toBe(null); // set is cleared
        expect(objectHasKey(result[2], 'set')).toBe(false); // set is not defined

        expect(result[1].str).toBe(undefined); // check str is not defined since it is a repeat
        expect(result[2].str).toBe(c.str);
      });
    });
  });
});
