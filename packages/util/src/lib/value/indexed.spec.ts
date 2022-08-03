import { range } from '../array/array.number';
import { IndexRange, indexRangeOverlapsIndexRangeFunction, isIndexNumberInIndexRangeFunction, isIndexRangeInIndexRangeFunction, sortAscendingIndexNumberRefFunction } from './indexed';

describe('sortAscendingIndexNumberRefFunction()', () => {
  describe('sort()', () => {
    it('should sort in ascending order.', () => {
      const items = range(0, 5).map((i) => ({ i: 4 - i }));

      expect(items[0].i).toBe(4);

      items.sort(sortAscendingIndexNumberRefFunction());

      expect(items[0].i).toBe(0);
    });
  });
});

describe('isIndexInIndexRangeFunction()', () => {
  describe('function', () => {
    const indexRange: IndexRange = { minIndex: 0, maxIndex: 2 };
    const isInIndexRange = isIndexNumberInIndexRangeFunction(indexRange);

    it('should return true if the index is contained within the range.', () => {
      expect(isInIndexRange(1)).toBe(true);
    });

    it('should return false if the indexRange is not contained within the range.', () => {
      expect(isInIndexRange(3)).toBe(false);
    });

    it('should return true if the minIndex is used as input.', () => {
      expect(isInIndexRange(indexRange.minIndex)).toBe(true);
    });

    it('should return false if the index is equal to the max index (exclusive).', () => {
      expect(isInIndexRange(indexRange.maxIndex)).toBe(false);
    });

    describe('inclusiveMaxIndex=true', () => {
      const isInIndexRange = isIndexNumberInIndexRangeFunction({ indexRange, inclusiveMaxIndex: true });

      it('should return true if the index is contained within the range.', () => {
        expect(isInIndexRange(1)).toBe(true);
      });

      it('should return false if the indexRange is not contained within the range.', () => {
        expect(isInIndexRange(3)).toBe(false);
      });

      it('should return true if the minIndex is used as input.', () => {
        expect(isInIndexRange(indexRange.minIndex)).toBe(true);
      });

      it('should return true if the index is equal to the max index (exclusive).', () => {
        expect(isInIndexRange(indexRange.maxIndex)).toBe(true);
      });
    });
  });
});

describe('isIndexRangeInIndexRangeFunction()', () => {
  describe('function', () => {
    const indexRange: IndexRange = { minIndex: 0, maxIndex: 2 };
    const isInIndexRange = isIndexRangeInIndexRangeFunction(indexRange);

    it('should return true if the indexRange is contained within the range entirely.', () => {
      const containedIndexRange: IndexRange = { minIndex: 1, maxIndex: 1 };
      expect(isInIndexRange(containedIndexRange)).toBe(true);
    });

    it('should return false if the indexRange is not contained within the range entirely.', () => {
      const containedIndexRange: IndexRange = { minIndex: 0, maxIndex: 3 };
      expect(isInIndexRange(containedIndexRange)).toBe(false);
    });

    it('should return true if the same indexRange is used as input.', () => {
      expect(isInIndexRange(indexRange)).toBe(true);
    });
  });
});

describe('indexRangeOverlapsIndexRangeFunction()', () => {
  describe('function', () => {
    const indexRange: IndexRange = { minIndex: 0, maxIndex: 2 };
    const overlapsIndexRange = indexRangeOverlapsIndexRangeFunction(indexRange);

    it('should return false if the indexRange is before range.', () => {
      const containedIndexRange = { minIndex: -10, maxIndex: -2 };
      expect(overlapsIndexRange(containedIndexRange)).toBe(false);
    });

    it('should return false if the indexRange is after the range.', () => {
      const containedIndexRange = { minIndex: indexRange.maxIndex + 1, maxIndex: indexRange.maxIndex + 2 };
      expect(overlapsIndexRange(containedIndexRange)).toBe(false);
    });

    it('should return true if the indexRange is contained within the range.', () => {
      const containedIndexRange = { minIndex: 1, maxIndex: 2 };
      expect(overlapsIndexRange(containedIndexRange)).toBe(true);
    });

    it('should return true if the indexRange overlaps the other date range entirely.', () => {
      const containedIndexRange = { minIndex: 0, maxIndex: 4 };
      expect(overlapsIndexRange(containedIndexRange)).toBe(true);
    });

    it('should return true if the indexRange overlaps the other date range partially at the start.', () => {
      const containedIndexRange = { minIndex: -1, maxIndex: 1 };
      expect(overlapsIndexRange(containedIndexRange)).toBe(true);
    });

    it('should return true if the indexRange overlaps the other date range partially at the end.', () => {
      const containedIndexRange = { minIndex: indexRange.maxIndex - 1, maxIndex: indexRange.maxIndex + 3 };
      expect(overlapsIndexRange(containedIndexRange)).toBe(true);
    });

    it('should return true if the same indexRange is used as input.', () => {
      expect(overlapsIndexRange(indexRange)).toBe(true);
    });
  });
});
