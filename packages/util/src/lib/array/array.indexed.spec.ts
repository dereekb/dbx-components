import { IndexNumber, IndexRef } from '../value';
import { getArrayNextIndex, indexedValuesArrayAccessorFactory, rangedIndexedValuesArrayAccessorFactory } from './array.indexed';
import { findNext } from './array.indexed';
import { range } from './array.number';

describe('findNext()', () => {
  const array = [0, 1, 2, 3, 4, 5];

  it('should return undefined for an empty array', () => {
    const result = findNext([], () => true);
    expect(result).toBeUndefined();
  });

  it('should return the next value', () => {
    range(0, array.length - 1).forEach((i) => {
      expect(findNext(array, (x) => x === i)).toBe(i + 1);
    });
  });

  describe('wrapAround=true', () => {
    it('should wrap around the array for the final index.', () => {
      const index = array.length - 1;
      const result = findNext(array, (x) => x === index, true);
      expect(result).toBe(0);
    });
  });
});

describe('getArrayNextIndex()', () => {
  const array = [0, 1, 2, 3, 4, 5];

  it('should return undefined for negative values.', () => {
    const result = getArrayNextIndex(array, -1);
    expect(result).toBeUndefined();
  });

  it('should return undefined for positive index values that are out of bounds.', () => {
    const result = getArrayNextIndex(array, array.length);
    expect(result).toBeUndefined();
  });

  it('should return the next index.', () => {
    range(0, array.length - 1).forEach((i) => {
      expect(getArrayNextIndex(array, i)).toBe(i + 1);
    });
  });

  it('should return undefined if the next index falls outside the array.', () => {
    const index = 5;
    const result = getArrayNextIndex(array, index);
    expect(result).toBeUndefined();
  });

  describe('wrapAround=true', () => {
    it('should wrap around the array for the final index.', () => {
      const index = array.length - 1;
      const result = getArrayNextIndex(array, index, true, 1);
      expect(result).toBe(0);
    });

    it('should wrap around the array by the additional amount.', () => {
      const expectedIndex = 0;
      const steps = array.length;
      const result = getArrayNextIndex(array, 0, true, steps);
      expect(result).toBe(expectedIndex);
    });
  });
});

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
