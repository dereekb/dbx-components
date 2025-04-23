import { filterValuesByDistance, filterValuesByDistanceNoOrder, makeBestFit, applyBestFit, filterAndMapFunction } from './array.filter';
import { copyArray } from './array';

describe('Array Filter Functions', () => {
  describe('filterValuesByDistance', () => {
    it('should throw error since it is not implemented', () => {
      expect(() => filterValuesByDistance([], 1, () => 0)).toThrow('Incomplete implementation!');
    });
  });

  describe('filterValuesByDistanceNoOrder', () => {
    it('should return empty array when input is empty', () => {
      const result = filterValuesByDistanceNoOrder([], 10, (x) => x);
      expect(result).toEqual([]);
    });

    it('should return the single item when input has only one item', () => {
      const input = [5];
      const result = filterValuesByDistanceNoOrder(input, 10, (x) => x);
      expect(result).toEqual([5]);
    });

    it('should filter out items that are too close together', () => {
      const input = [1, 5, 6, 20, 22, 40];
      const result = filterValuesByDistanceNoOrder(input, 5, (x) => x);
      expect(result).toEqual([1, 6, 20, 40]);
    });

    it('should sort items by their numeric value', () => {
      const input = [40, 1, 22, 5, 20, 6];
      const result = filterValuesByDistanceNoOrder(input, 5, (x) => x);
      expect(result).toEqual([1, 6, 20, 40]);
    });

    it('should filter out values with null from getValue', () => {
      const input = [1, 6, null, 20, undefined];
      const result = filterValuesByDistanceNoOrder(input, 5, (x) => (x === null || x === undefined ? null : x));
      expect(result).toEqual([1, 6, 20]);
    });

    it('should handle objects with custom getValue function', () => {
      const input = [
        { id: 1, value: 10 },
        { id: 2, value: 12 },
        { id: 3, value: 25 },
        { id: 4, value: 27 },
        { id: 5, value: 50 }
      ];

      const result = filterValuesByDistanceNoOrder(input, 5, (item) => item.value);
      expect(result).toEqual([
        { id: 1, value: 10 },
        { id: 3, value: 25 },
        { id: 5, value: 50 }
      ]);
    });
  });

  describe('makeBestFit', () => {
    interface TestItem {
      id: number;
      selected: boolean;
    }

    const items: TestItem[] = [
      { id: 1, selected: false },
      { id: 2, selected: true },
      { id: 3, selected: true },
      { id: 4, selected: false }
    ];

    const filter = (item: TestItem) => item.selected;
    const compare = (a: TestItem, b: TestItem) => a.id - b.id; // Higher id is better
    const updateNonBestFit = (item: TestItem) => ({ ...item, selected: false });

    it('should create a new array with the best fit item and transform others', () => {
      const result = makeBestFit(items, filter, compare, updateNonBestFit);

      // Original array should not be modified
      expect(items).toEqual([
        { id: 1, selected: false },
        { id: 2, selected: true },
        { id: 3, selected: true },
        { id: 4, selected: false }
      ]);

      // Result should have the highest id item selected
      expect(result).toEqual([
        { id: 1, selected: false },
        { id: 2, selected: false }, // Deselected
        { id: 3, selected: true }, // Best fit (highest id)
        { id: 4, selected: false }
      ]);
    });

    it('should not modify anything if only one item matches the filter', () => {
      const singleSelectedItems: TestItem[] = [
        { id: 1, selected: false },
        { id: 2, selected: true },
        { id: 3, selected: false },
        { id: 4, selected: false }
      ];

      const result = makeBestFit(singleSelectedItems, filter, compare, updateNonBestFit);

      expect(result).toEqual([
        { id: 1, selected: false },
        { id: 2, selected: true },
        { id: 3, selected: false },
        { id: 4, selected: false }
      ]);
    });

    it('should handle an empty array', () => {
      const result = makeBestFit([], filter, compare, updateNonBestFit);
      expect(result).toEqual([]);
    });

    it('should handle array with no matches', () => {
      const noMatchItems: TestItem[] = [
        { id: 1, selected: false },
        { id: 2, selected: false }
      ];

      const result = makeBestFit(noMatchItems, filter, compare, updateNonBestFit);
      expect(result).toEqual(noMatchItems);
    });
  });

  describe('applyBestFit', () => {
    interface TestItem {
      id: number;
      selected: boolean;
    }

    const items: TestItem[] = [
      { id: 1, selected: false },
      { id: 2, selected: true },
      { id: 3, selected: true },
      { id: 4, selected: false }
    ];

    const filter = (item: TestItem) => item.selected;
    const compare = (a: TestItem, b: TestItem) => b.id - a.id; // Lower id is better, sort from highest index to lowest index
    const updateNonBestFit = (item: TestItem) => ({ ...item, selected: false });

    it('should modify the input array to keep the best fit and transform others', () => {
      const inputCopy = copyArray(items);
      const result = applyBestFit(inputCopy, filter, compare, updateNonBestFit);

      // Result should be the same array instance as input
      expect(result).toBe(inputCopy);

      // Input should be modified to have the lowest id item selected
      expect(inputCopy).toEqual([
        { id: 1, selected: false },
        { id: 2, selected: true }, // Best fit (lowest id)
        { id: 3, selected: false }, // Deselected
        { id: 4, selected: false }
      ]);
    });

    it('should not modify anything if only one item matches the filter', () => {
      const singleSelectedItems = [
        { id: 1, selected: false },
        { id: 2, selected: true },
        { id: 3, selected: false }
      ];

      const result = applyBestFit(singleSelectedItems, filter, compare, updateNonBestFit);

      expect(result).toEqual([
        { id: 1, selected: false },
        { id: 2, selected: true },
        { id: 3, selected: false }
      ]);
    });

    it('should handle an empty array', () => {
      const emptyArray: TestItem[] = [];
      const result = applyBestFit(emptyArray, filter, compare, updateNonBestFit);
      expect(result).toEqual([]);
    });
  });

  describe('filterAndMapFunction', () => {
    it('should filter items and map them to new values', () => {
      const values = [1, 2, 3, 4, 5, 6];
      const isEven = (x: number) => x % 2 === 0;
      const double = (x: number) => x * 2;

      const filterAndMap = filterAndMapFunction(isEven, double);
      const result = filterAndMap(values);

      expect(result).toEqual([4, 8, 12]); // [2*2, 4*2, 6*2]
    });

    it('should return empty array when no items match the filter', () => {
      const values = [1, 3, 5];
      const isEven = (x: number) => x % 2 === 0;
      const double = (x: number) => x * 2;

      const filterAndMap = filterAndMapFunction(isEven, double);
      const result = filterAndMap(values);

      expect(result).toEqual([]);
    });

    it('should handle empty iterable', () => {
      const values: number[] = [];
      const isEven = (x: number) => x % 2 === 0;
      const double = (x: number) => x * 2;

      const filterAndMap = filterAndMapFunction(isEven, double);
      const result = filterAndMap(values);

      expect(result).toEqual([]);
    });

    it('should work with iterables that are not arrays', () => {
      const values = new Set([1, 2, 3, 4, 5]);
      const isEven = (x: number) => x % 2 === 0;
      const double = (x: number) => x * 2;

      const filterAndMap = filterAndMapFunction(isEven, double);
      const result = filterAndMap(values);

      expect(result).toEqual([4, 8]); // [2*2, 4*2]
    });

    it('should handle complex objects', () => {
      interface TestItem {
        id: number;
        value: string;
      }

      const items: TestItem[] = [
        { id: 1, value: 'a' },
        { id: 2, value: 'b' },
        { id: 3, value: 'c' }
      ];

      const hasEvenId = (item: TestItem) => item.id % 2 === 0;
      const toUpperValue = (item: TestItem) => item.value.toUpperCase();

      const filterAndMap = filterAndMapFunction(hasEvenId, toUpperValue);
      const result = filterAndMap(items);

      expect(result).toEqual(['B']); // Item with id 2 has value 'b' -> 'B'
    });
  });
});
