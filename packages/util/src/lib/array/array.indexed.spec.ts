import { IndexNumber } from '@dereekb/util';
import { IndexRef } from '../value';
import { indexedValuesArrayAccessorFactory, rangedIndexedValuesArrayAccessorFactory } from './array.indexed';

interface TestItemWithOneIndex extends IndexRef {
  value: string;
}

interface TestItemWithTwoIndexes extends TestItemWithOneIndex {
  to: IndexNumber;
}

describe('indexedValuesArrayAccessorInfoFactory()', () => {
  describe('function', () => {
    describe('scenario', () => {
      describe('finding items in a specific range.', () => {
        const factory = rangedIndexedValuesArrayAccessorFactory((value: TestItemWithTwoIndexes) => {
          return {
            minIndex: value.i,
            maxIndex: value.to
          };
        });

        const valuesWithOneIndex = [
          { i: 0, to: 5, value: 'a' },
          { i: 10, to: 50, value: 'b' },
          { i: 100, to: 500, value: 'c' }
        ];

        const findInArray = factory(valuesWithOneIndex);

        it('index of 4 should return item with value "a".', () => {
          const result = findInArray(4);
          expect(result!.value).toBe('a');
        });

        it('index of 5 should return undefined.', () => {
          const result = findInArray(5);
          expect(result).toBe(undefined);
        });

        it('index of 10 should return item with value "b".', () => {
          const result = findInArray(10);
          expect(result!.value).toBe('b');
        });

        it('index of 99 should return undefined".', () => {
          const result = findInArray(99);
          expect(result).toBeUndefined();
        });

        it('index of 400 should return item with value "c".', () => {
          const result = findInArray(400);
          expect(result!.value).toBe('c');
        });

        it('index of 500 should return undefined".', () => {
          const result = findInArray(500);
          expect(result).toBeUndefined();
        });
      });

      describe('finding items with the closest min index.', () => {
        const factory = indexedValuesArrayAccessorFactory((value: TestItemWithOneIndex) => {
          return {
            minIndex: value.i,
            maxIndex: value.i + 1
          };
        });

        const valuesWithOneIndex = [
          { i: 0, value: 'a' },
          { i: 10, value: 'b' },
          { i: 100, value: 'c' }
        ];

        const findInArray = factory(valuesWithOneIndex);

        it('index of 5 should return item with value "a".', () => {
          const result = findInArray(0);
          expect(result.value).toBe('a');
        });

        it('index of 10 should return item with value "b".', () => {
          const result = findInArray(10);
          expect(result.value).toBe('b');
        });

        it('index of 99 should return item with value "b".', () => {
          const result = findInArray(99);
          expect(result.value).toBe('b');
        });

        it('index of 1000 should return item with value "c".', () => {
          const result = findInArray(1000);
          expect(result.value).toBe('c');
        });
      });
    });
  });
});
