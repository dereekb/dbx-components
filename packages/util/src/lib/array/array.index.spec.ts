import { findToIndexSet, expandIndexSet, findBest, findBestIndexSetPair, sliceIndexRangeFunction, type IndexSet, type IndexSetPairSet } from './array.index';

describe('Array Index Functions', () => {
  describe('findToIndexSet', () => {
    it('should return an empty array when no items match the filter', () => {
      const input = [1, 2, 3, 4, 5];
      const filter = (x: number) => x > 10;

      const result = findToIndexSet(input, filter);

      expect(result).toEqual([]);
    });

    it('should return indices of items that match the filter', () => {
      const input = [1, 2, 3, 4, 5];
      const filter = (x: number) => x % 2 === 0; // Even numbers

      const result = findToIndexSet(input, filter);

      expect(result).toEqual([1, 3]); // Indices of 2 and 4
    });

    it('should handle an empty input array', () => {
      const input: number[] = [];
      const filter = (x: number) => x > 0;

      const result = findToIndexSet(input, filter);

      expect(result).toEqual([]);
    });

    it('should work with object arrays and complex filters', () => {
      interface TestItem {
        id: number;
        active: boolean;
      }

      const input: TestItem[] = [
        { id: 1, active: true },
        { id: 2, active: false },
        { id: 3, active: true },
        { id: 4, active: false },
        { id: 5, active: true }
      ];

      const filter = (item: TestItem) => item.active && item.id > 2;

      const result = findToIndexSet(input, filter);

      expect(result).toEqual([2, 4]); // Indices of items with id 3 and 5
    });
  });

  describe('expandIndexSet', () => {
    it('should return an array of pairs containing index and item', () => {
      const input = ['a', 'b', 'c', 'd', 'e'];
      const indexSet: IndexSet = [0, 2, 4]; // Indices for 'a', 'c', 'e'

      const result = expandIndexSet(input, indexSet);

      expect(result).toEqual([
        { i: 0, item: 'a' },
        { i: 2, item: 'c' },
        { i: 4, item: 'e' }
      ]);
    });

    it('should handle an empty index set', () => {
      const input = ['a', 'b', 'c'];
      const indexSet: IndexSet = [];

      const result = expandIndexSet(input, indexSet);

      expect(result).toEqual([]);
    });

    it('should include undefined for indices that are out of bounds', () => {
      const input = ['a', 'b', 'c'];
      const indexSet: IndexSet = [0, 3, 5]; // 3 and 5 are out of bounds

      const result = expandIndexSet(input, indexSet);

      expect(result).toEqual([
        { i: 0, item: 'a' },
        { i: 3, item: undefined },
        { i: 5, item: undefined }
      ]);
    });
  });

  describe('findBest', () => {
    it('should find the item with highest value according to compare function', () => {
      const input = [5, 3, 8, 1, 7];
      const compare = (a: number, b: number) => a - b; // Ascending, so highest value wins

      const result = findBest(input, compare);

      expect(result).toEqual({
        i: 2,
        item: 8
      });
    });

    it('should find the item with lowest value when compare function is reversed', () => {
      const input = [5, 3, 8, 1, 7];
      const compare = (a: number, b: number) => b - a; // Descending, so lowest value wins

      const result = findBest(input, compare);

      expect(result).toEqual({
        i: 3,
        item: 1
      });
    });

    it('should return the first item when all items are equal', () => {
      const input = [5, 5, 5, 5];
      const compare = (a: number, b: number) => a - b;

      const result = findBest(input, compare);

      expect(result).toEqual({
        i: 0,
        item: 5
      });
    });

    it('should work with complex objects and comparison', () => {
      interface TestItem {
        id: number;
        priority: number;
      }

      const input: TestItem[] = [
        { id: 1, priority: 3 },
        { id: 2, priority: 1 },
        { id: 3, priority: 5 },
        { id: 4, priority: 2 }
      ];

      const compare = (a: TestItem, b: TestItem) => a.priority - b.priority;

      const result = findBest(input, compare);

      expect(result).toEqual({
        i: 2,
        item: { id: 3, priority: 5 }
      });
    });

    it('should handle null values by keeping the non-null value', () => {
      const input = [null, 5, null, 8, null];
      const compare = (a: number, b: number) => (a || 0) - (b || 0);

      // @ts-expect-error - Testing with null values
      const result = findBest(input, compare);

      expect(result).toEqual({
        i: 3,
        item: 8
      });
    });
  });

  describe('findBestIndexSetPair', () => {
    it('should find the best item in the IndexSetPairSet', () => {
      const input: IndexSetPairSet<number> = [
        { i: 0, item: 5 },
        { i: 2, item: 8 },
        { i: 4, item: 3 }
      ];

      const compare = (a: number, b: number) => a - b; // Ascending, so highest value wins

      const result = findBestIndexSetPair(input, compare);

      expect(result).toEqual({
        i: 2,
        item: 8
      });
    });

    it('should handle null items by preferring non-null items', () => {
      const input: IndexSetPairSet<number> = [
        { i: 0, item: null },
        { i: 2, item: 8 },
        { i: 4, item: null }
      ];

      const compare = (a: number, b: number) => a - b; // Ascending, so highest value wins

      const result = findBestIndexSetPair(input, compare);

      expect(result).toEqual({
        i: 2,
        item: 8
      });
    });

    it('should return the first pair when all items are null', () => {
      const input: IndexSetPairSet<number> = [
        { i: 0, item: null },
        { i: 2, item: null },
        { i: 4, item: null }
      ];

      const compare = (a: number, b: number) => a - b; // Ascending, so highest value wins

      const result = findBestIndexSetPair(input, compare);

      expect(result).toEqual({
        i: 0,
        item: null
      });
    });
  });

  describe('sliceIndexRangeFunction', () => {
    it('should slice an array based on the index range', () => {
      const input = ['a', 'b', 'c', 'd', 'e', 'f'];
      const slicer = sliceIndexRangeFunction<string>({ minIndex: 1, maxIndex: 4 });

      const result = slicer(input);

      expect(result).toEqual(['b', 'c', 'd']); // min is inclusive, max is exclusive
    });

    it('should handle ranges with only index specified', () => {
      const input = ['a', 'b', 'c', 'd', 'e'];
      const slicer = sliceIndexRangeFunction<string>(2);

      const result = slicer(input);

      expect(result).toEqual(['c']);
    });

    it('should handle out-of-bounds ranges', () => {
      const input = ['a', 'b', 'c'];
      const slicer = sliceIndexRangeFunction<string>({ minIndex: 5, maxIndex: 10 });

      const result = slicer(input);
      expect(result).toEqual([]);
    });

    it('should handle negative out-of-bounds ranges', () => {
      const input = ['a', 'b', 'c'];
      const slicer = sliceIndexRangeFunction<string>({ minIndex: -5, maxIndex: -10 });

      const result = slicer(input);
      expect(result).toEqual([]);
    });

    it('should return an empty array when min is greater than max', () => {
      const input = ['a', 'b', 'c', 'd', 'e'];
      const slicer = sliceIndexRangeFunction<string>({ minIndex: 4, maxIndex: 2 });

      const result = slicer(input);

      expect(result).toEqual([]);
    });
  });
});
