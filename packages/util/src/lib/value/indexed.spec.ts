import { range } from '../array/array.number';
import { computeNextFreeIndexFunction, findBestIndexMatchFunction, findItemsByIndex, indexDeltaGroupFunction, type IndexRange, indexRangeOverlapsIndexRangeFunction, type IndexRef, isIndexNumberInIndexRangeFunction, isIndexRangeInIndexRangeFunction, minAndMaxIndexFunction, minAndMaxIndexItemsFunction, sortAscendingIndexNumberRefFunction, stepsFromIndexFunction, wrapIndexRangeFunction, filterUniqueByIndex } from './indexed';

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

describe('computeNextFreeIndexFunction()', () => {
  describe('function', () => {
    const fn = computeNextFreeIndexFunction<IndexRef>((x) => x.i);

    it('should return 0 if the input is empty', () => {
      const items: IndexRef[] = [];
      const result = fn(items);
      expect(result).toBe(0);
    });

    it('should return the next index', () => {
      const min = 0;
      const max = 5;
      const expectedNextIndex = max + 1;
      const items = range(min, max + 1).map((i) => ({ i }));
      const result = fn(items);

      expect(result).toBe(expectedNextIndex);
    });
  });
});

describe('minAndMaxIndexFunction()', () => {
  describe('function', () => {
    const fn = minAndMaxIndexFunction<IndexRef>((x) => x.i);

    it('should return null if the input is empty.', () => {
      const items: IndexRef[] = [];
      const result = fn(items);
      expect(result).toBeNull();
    });

    it('should return the min and max index of a single item', () => {
      const min = 0;
      const max = min;
      const items = range(min, max + 1).map((i) => ({ i }));
      const result = fn(items);

      expect(result?.min).toBe(min);
      expect(result?.max).toBe(max);
    });

    it('should return the min and max index', () => {
      const min = 0;
      const max = 5;
      const items = range(min, max + 1).map((i) => ({ i }));
      const result = fn(items);

      expect(result?.min).toBe(min);
      expect(result?.max).toBe(max);
    });
  });
});

describe('minAndMaxIndexItemsFunction()', () => {
  describe('function', () => {
    const fn = minAndMaxIndexItemsFunction<IndexRef>((x) => x.i);

    it('should return null if the input is empty.', () => {
      const items: IndexRef[] = [];
      const result = fn(items);
      expect(result).toBeNull();
    });

    it('should return the min and max index of a single item', () => {
      const min = 0;
      const max = min;
      const items = range(min, max + 1).map((i) => ({ i }));
      const result = fn(items);

      expect(result?.min.i).toBe(min);
      expect(result?.max.i).toBe(max);
    });

    it('should return the min and max index', () => {
      const min = 0;
      const max = 5;
      const items = range(min, max + 1).map((i) => ({ i }));
      const result = fn(items);

      expect(result?.min.i).toBe(min);
      expect(result?.max.i).toBe(max);
    });
  });
});

type ValueWithMaybeIndex = Partial<IndexRef> & {
  x: string;
};

describe('indexDeltaGroupFunction()', () => {
  describe('function', () => {
    const groupingFunction = indexDeltaGroupFunction<ValueWithMaybeIndex>((x) => x.i);

    it('should group items without a null/undefined index as newItems', () => {
      const result = groupingFunction([{ x: 'a' }, { x: 'b', i: 0 }, { x: 'c', i: 1 }]);

      expect(result.newItems.length).toBe(1);
      expect(result.currentItems.length).toBe(2);
    });

    describe('with previous items', () => {
      it('should separate current and deleted items', () => {
        const previousItems = [
          { x: 'b', i: 0 },
          { x: 'c', i: 1 }
        ];
        const result = groupingFunction([{ x: 'a' }, { x: 'b', i: 0 }, { x: 'd', i: 2 }], previousItems);

        expect(result.newItems.length).toBe(1);
        expect(result.currentItems.length).toBe(2);
        expect(result.currentItems[0].x).toBe('b');
        expect(result.currentItems[1].x).toBe('d');
        expect(result.deletedItems?.length).toBe(1);
        expect(result.deletedItems?.[0].x).toBe('c');
      });

      it('should capture all deletedItems', () => {
        const previousItems = [
          { x: 'b', i: 0 },
          { x: 'c', i: 1 }
        ];
        const result = groupingFunction([{ x: 'a' }], previousItems);

        expect(result.newItems.length).toBe(1);
        expect(result.currentItems.length).toBe(0);
        expect(result.deletedItems?.length).toBe(2);
        expect(result.deletedItems?.[0].x).toBe('b');
        expect(result.deletedItems?.[1].x).toBe('c');
      });
    });
  });
});

describe('findItemsByIndex()', () => {
  it('should return the items with the filtered indexes.', () => {
    const indexes = [0, 1, 2, 3, 4, 5];
    const values = indexes.map((i) => ({ i, name: String(i) }));

    const result = findItemsByIndex({
      values,
      indexes: [1, 2]
    });

    expect(result).toContain(values[1]);
    expect(result).toContain(values[2]);
  });
});

describe('findBestIndexMatchFunction()', () => {
  it('should return the best index match.', () => {
    const options = [0, 5, 10, 15, 20].map((i) => ({ i }));
    const fn = findBestIndexMatchFunction(options);

    expect(fn({ i: 4 })).toBe(options[0]);
    expect(fn({ i: 6 })).toBe(options[1]);
    expect(fn({ i: 11 })).toBe(options[2]);
    expect(fn({ i: 16 })).toBe(options[3]);
    expect(fn({ i: 21 })).toBe(options[4]);
    expect(fn({ i: 200 })).toBe(options[4]);
  });
});

describe('filterUniqueByIndex', () => {
  it('should filter the input items uniquely by their index.', () => {
    const items = range(0, 5).map((i) => ({ i }));
    const input = [...items, ...items];

    const result = filterUniqueByIndex(input);

    expect(result).toHaveLength(items.length);
    expect(result[0].i).toBe(items[0].i);
    expect(result[1].i).toBe(items[1].i);
    expect(result[2].i).toBe(items[2].i);
    expect(result[3].i).toBe(items[3].i);
    expect(result[4].i).toBe(items[4].i);
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

describe('wrapIndexRangeFunction()', () => {
  describe('function', () => {
    const inputRange = { minIndex: 0, maxIndex: 6 };

    describe('fenceposts=true', () => {
      const fn = wrapIndexRangeFunction(inputRange, true);

      it('should retain numbers within the range.', () => {
        range(inputRange).forEach((i) => {
          expect(fn(i)).toBe(i);
        });
      });

      it('should wrap the index number from the positive side.', () => {
        expect(fn(inputRange.maxIndex)).toBe(0);
      });

      it('should wrap the index number from the negative side.', () => {
        expect(fn(-1)).toBe(inputRange.maxIndex - 1);
      });
    });
  });
});

describe('stepsFromIndexFunction()', () => {
  describe('function', () => {
    describe('ranges', () => {
      describe('simple range', () => {
        const simpleRange: IndexRange = { minIndex: 0, maxIndex: 6 };

        describe('fitToRange=true', () => {
          const fn = stepsFromIndexFunction({ range: simpleRange, fitToRange: true });

          it('should return the next index from -1', () => {
            const index = -1; // will be taking 1 step forward
            const result = fn(index, true);
            expect(result).toBe(0);
          });

          describe('wrapAround=true', () => {
            it('should return the fitted and wrapped value from a negative value and negative step', () => {
              const index = 0; // will be taking 1 step forward
              const result = fn(index, true, -1);
              expect(result).toBe(simpleRange.maxIndex - 1);
            });

            it('should return the fitted and wrapped value from a positive value and positive step', () => {
              const index = simpleRange.maxIndex; // will be taking 1 step forward too
              const result = fn(index, true, 1);
              expect(result).toBe(simpleRange.minIndex + 1);
            });
          });
        });

        describe('with defaults', () => {
          const fn = stepsFromIndexFunction({ range: simpleRange });

          it('should return undefined for a value smaller than the minimum.', () => {
            const result = fn(simpleRange.minIndex - 1);
            expect(result).toBeUndefined();
          });

          it('should return the next index.', () => {
            range({ ...simpleRange, maxIndex: simpleRange.maxIndex - 1 }).forEach((i) => {
              expect(fn(i)).toBe(i + 1);
            });
          });

          it('should return undefined if the next index falls outside the array.', () => {
            const index = 5;
            const result = fn(index);
            expect(result).toBeUndefined();
          });

          describe('wrapAround=true', () => {
            it('should return undefined for a start value outside the range.', () => {
              const index = -1;
              const result = fn(index, true);
              expect(result).toBeUndefined();
            });

            it('should wrap around the array for the end index.', () => {
              const index = simpleRange.maxIndex - 1;
              const result = fn(index, true);
              expect(result).toBe(0);
            });

            it('should wrap around the end of the array by the additional amount.', () => {
              const expectedIndex = 0;
              const extraWrapsWidth = simpleRange.maxIndex - 1;
              const steps = extraWrapsWidth + 1;
              const result = fn(0, true, steps); // start at index 0 and take 5 + 5 + 1 steps, should end up at 0.
              expect(result).toBe(expectedIndex);
            });

            it('should wrap around the array multiple times by the additional amount.', () => {
              const expectedIndex = 0;
              const extraWrapsWidth = simpleRange.maxIndex - 1;
              const steps = extraWrapsWidth * 2 + 1;
              const result = fn(0, true, steps); // start at index 0 and take 5 + 5 + 1 steps, should end up at 0.
              expect(result).toBe(expectedIndex);
            });
          });
        });
      });
    });
  });
});
