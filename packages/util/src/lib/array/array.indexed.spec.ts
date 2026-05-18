import { type IndexNumber, type IndexRef } from '../value';
import { getArrayNextIndex, indexedValuesArrayAccessorFactory, rangedIndexedValuesArrayAccessorFactory, rangedIndexedValuesArrayAccessorInfoFactory, findNext } from './array.indexed';
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

describe('rangedIndexedValuesArrayAccessorInfoFactory()', () => {
  const factory = rangedIndexedValuesArrayAccessorInfoFactory<TestItemWithTwoIndexes>({
    readIndexRange: (value) => ({ minIndex: value.i, maxIndex: value.to })
  });

  describe('with an empty values array', () => {
    const accessor = factory([]);

    it('should return an empty info object for any index', () => {
      expect(accessor(0)).toEqual({});
      expect(accessor(100)).toEqual({});
    });
  });

  describe('with values', () => {
    const values: TestItemWithTwoIndexes[] = [
      { i: 0, to: 5, value: 'a' },
      { i: 10, to: 50, value: 'b' },
      { i: 100, to: 500, value: 'c' }
    ];

    const accessor = factory(values);

    it('should return the matching value with prev and next neighbors', () => {
      const result = accessor(20);
      expect(result.match?.value).toBe('b');
      expect(result.prev?.value).toBe('a');
      expect(result.next?.value).toBe('c');
    });

    it('should return undefined match for an index in a gap between ranges', () => {
      const result = accessor(7);
      expect(result.match).toBeUndefined();
      // prev should be the range before the gap, next should be the range after
      expect(result.prev?.value).toBe('a');
      expect(result.next?.value).toBe('b');
    });

    it('should return undefined match for an index past all ranges, with prev set to the last range', () => {
      const result = accessor(1000);
      expect(result.match).toBeUndefined();
      expect(result.prev?.value).toBe('c');
      expect(result.next).toBeUndefined();
    });

    it('should return undefined match for an index before all ranges, with next set to the first range', () => {
      const result = accessor(-1);
      expect(result.match).toBeUndefined();
      expect(result.prev).toBeUndefined();
      expect(result.next?.value).toBe('a');
    });

    it('should match the first range and have no prev', () => {
      const result = accessor(2);
      expect(result.match?.value).toBe('a');
      expect(result.prev).toBeUndefined();
      expect(result.next?.value).toBe('b');
    });

    it('should match the last range and have no next', () => {
      const result = accessor(200);
      expect(result.match?.value).toBe('c');
      expect(result.prev?.value).toBe('b');
      expect(result.next).toBeUndefined();
    });
  });
});
