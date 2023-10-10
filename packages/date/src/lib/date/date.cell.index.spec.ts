import { itShouldFail, expectFail } from '@dereekb/util/test';
import { range } from '@dereekb/util';
import {
  allIndexesInDateCellRanges,
  dateCellRange,
  dateCellRangeBlocksCount,
  dateCellRangeBlocksCountInfo,
  dateCellRangeIncludedByRangeFunction,
  dateCellRangeOverlapsRangeFunction,
  dateCellRangesFullyCoverDateCellRangeFunction,
  dateRelativeStateForDateCellRangeComparedToIndex,
  expandDateCellRange,
  expandUniqueDateCellsFunction,
  filterDateCellsInDateCellRange,
  getGreatestDateCellIndexInDateCellRanges,
  getLeastAndGreatestDateCellIndexInDateCellRanges,
  getLeastDateCellIndexInDateCellRanges,
  getNextDateCellTimingIndex,
  groupToDateCellRanges,
  groupUniqueDateCells,
  isDateCellRange,
  isDateCellWithinDateCellRangeFunction,
  isValidDateCellRange,
  isValidDateCellRangeSeries,
  sortDateCellRanges,
  UniqueDateCellRange
} from './date.cell.index';

describe('isDateCellRange()', () => {
  it('should return true if the input is a DateCellRange with i set', () => {
    expect(isDateCellRange({ i: 1 })).toBe(true);
  });

  it('should return true if the input is a DateCellRange with i and to set', () => {
    expect(isDateCellRange({ i: 1, to: 0 })).toBe(true);
  });

  it('should return true if the input is an invalid DateCellRange with i and to set', () => {
    expect(isDateCellRange({ i: 1, to: 0 })).toBe(true);
  });
});

describe('isValidDateCellRange()', () => {
  it('should return false if to is less than i.', () => {
    expect(isValidDateCellRange({ i: 1, to: 0 })).toBe(false);
  });

  it('should return false if to is a non-integer.', () => {
    expect(isValidDateCellRange({ i: 0, to: 1.2 })).toBe(false);
  });

  it('should return false if i is negative', () => {
    expect(isValidDateCellRange({ i: -1 })).toBe(false);
  });

  it('should return false if i is a non-integer value.', () => {
    expect(isValidDateCellRange({ i: 1.2 })).toBe(false);
  });

  it('should return true if only i is provided', () => {
    expect(isValidDateCellRange({ i: 1 })).toBe(true);
  });

  it('should return true for a valid range.', () => {
    expect(isValidDateCellRange({ i: 1, to: 5 })).toBe(true);
  });
});

describe('isValidDateCellRangeSeries()', () => {
  it('should return false if one input is not a valid series.', () => {
    expect(isValidDateCellRangeSeries([{ i: 1, to: 0 }])).toBe(false);
  });

  it('should return false if one index is repeated.', () => {
    expect(
      isValidDateCellRangeSeries([
        { i: 0, to: 2 },
        { i: 2, to: 3 }
      ])
    ).toBe(false);
  });

  it('should return true for a single item series.', () => {
    expect(isValidDateCellRangeSeries([{ i: 0, to: 2 }])).toBe(true);
  });

  it('should return true for a valid series.', () => {
    expect(
      isValidDateCellRangeSeries([
        { i: 0, to: 2 },
        { i: 3, to: 5 }
      ])
    ).toBe(true);
  });
});

describe('getLeastDateCellIndexInDateCellRanges()', () => {
  it('should return 0 for empty arrays.', () => {
    const greatestIndex = 0;

    const result = getLeastDateCellIndexInDateCellRanges([]);
    expect(result).toBe(greatestIndex);
  });

  it('should return the least index in the input ranges.', () => {
    const leastIndex = 3;

    const result = getLeastDateCellIndexInDateCellRanges([{ i: leastIndex }, { i: 12, to: 23 }, { i: 40, to: 42 }, { i: 50, to: 55 }]);
    expect(result).toBe(leastIndex);
  });
});

describe('getGreatestDateCellIndexInDateCellRanges()', () => {
  it('should return 0 for empty arrays.', () => {
    const greatestIndex = 0;

    const result = getGreatestDateCellIndexInDateCellRanges([]);
    expect(result).toBe(greatestIndex);
  });

  it('should return the largest index in the input ranges.', () => {
    const greatestIndex = 100;

    const result = getGreatestDateCellIndexInDateCellRanges([{ i: 0 }, { i: 12, to: 23 }, { i: 40, to: greatestIndex }, { i: 50, to: 55 }]);
    expect(result).toBe(greatestIndex);
  });
});

describe('getLeastAndGreatestDateCellIndexInDateCellRanges()', () => {
  it('should return null for empty arrays.', () => {
    const result = getLeastAndGreatestDateCellIndexInDateCellRanges([]);
    expect(result).toBe(null);
  });
});

describe('dateCellRangeIncludedByRangeFunction()', () => {
  describe('function', () => {
    const range = dateCellRange(5, 10);
    const fn = dateCellRangeIncludedByRangeFunction(range);

    it('should return true for the same range.', () => {
      const result = fn(range);
      expect(result).toBe(true);
    });

    it('should return true for a range that is larger and includes the full range.', () => {
      const result = fn(dateCellRange(2, 12));
      expect(result).toBe(true);
    });

    it('should return false for a range that is smaller and does not include the full range.', () => {
      const result = fn(dateCellRange(1, 4));
      expect(result).toBe(false);
    });

    it('should return false for a range that is partial and does not include the full range.', () => {
      const result = fn(dateCellRange(5, 8));
      expect(result).toBe(false);
    });

    it('should return false for a range that is partial and bigger and does not include the full range.', () => {
      const result = fn(dateCellRange(6, 12));
      expect(result).toBe(false);
    });
  });
});

describe('dateCellRangeOverlapsRangeFunction()', () => {
  describe('function', () => {
    describe('index 8', () => {
      const fn = dateCellRangeOverlapsRangeFunction(8);

      it('should return true for the range 8-9', () => {
        const result = fn({ i: 8, to: 9 });
        expect(result).toBe(true);
      });

      it('should return true for the range 0-1000', () => {
        const result = fn({ i: 0, to: 1000 });
        expect(result).toBe(true);
      });

      it('should return false for the range 0-0', () => {
        const result = fn({ i: 0, to: 0 });
        expect(result).toBe(false);
      });

      it('should work with the findIndex function', () => {
        const ranges = [
          { i: 4, to: 4 },
          { i: 8, to: 9 }
        ];

        const result = ranges.findIndex(fn);
        expect(result).toBe(1);
      });
    });

    describe('range 5-10', () => {
      const range = dateCellRange(5, 10);
      const fn = dateCellRangeOverlapsRangeFunction(range);

      it('should return true for the same range.', () => {
        const result = fn(range);
        expect(result).toBe(true);
      });

      it('should return true for a range that is larger and includes the full range.', () => {
        const result = fn(dateCellRange(2, 12));
        expect(result).toBe(true);
      });

      it('should return false for a range that is smaller and does not overlap.', () => {
        const result = fn(dateCellRange(1, 4));
        expect(result).toBe(false);
      });

      it('should return true for a range that has a partial overlap.', () => {
        const result = fn(dateCellRange(5, 8));
        expect(result).toBe(true);
      });

      it('should return true for a range that is partial and bigger and does not include the full range.', () => {
        const result = fn(dateCellRange(6, 12));
        expect(result).toBe(true);
      });
    });
  });
});

describe('sortDateCellRanges', () => {
  it('should retain the order for items that have the same start index.', () => {
    const allBlocks = [
      {
        i: 0,
        to: 2,
        id: 'a'
      },
      { i: 0, to: undefined, id: 'b' },
      { i: 0, to: 3, id: 'c' },
      { i: 0, to: 1, id: 'd' },
      { i: 0, to: 100, id: 'e' }
    ];

    const sorted = sortDateCellRanges(allBlocks);

    expect(sorted[0].id).toBe('a');
    expect(sorted[1].id).toBe('b');
    expect(sorted[2].id).toBe('c');
    expect(sorted[3].id).toBe('d');
    expect(sorted[4].id).toBe('e');
  });

  it('should retain the before/after order for items that have the same start index.', () => {
    const allBlocks = [
      {
        i: 0,
        to: 2,
        id: 'a'
      },
      { i: 1, to: undefined, id: 'b' },
      { i: 2, to: 3, id: 'c' },
      { i: 3, to: 1, id: 'd' },
      { i: 0, to: 100, id: 'e' }
    ];

    const sorted = sortDateCellRanges(allBlocks);

    expect(sorted[0].id).toBe('a');
    expect(sorted[1].id).toBe('e');
    expect(sorted[2].id).toBe('b');
    expect(sorted[3].id).toBe('c');
    expect(sorted[4].id).toBe('d');
  });
});

describe('isDateCellWithinDateCellRangeFunction()', () => {
  describe('function', () => {
    describe('range 0-0', () => {
      const fn = isDateCellWithinDateCellRangeFunction({ i: 0, to: 0 });

      it('should return false for the range 0-1000', () => {
        const result = fn({ i: 0, to: 1000 });
        expect(result).toBe(false);
      });

      it('should return true for the range 0-0', () => {
        const result = fn({ i: 0, to: 0 });
        expect(result).toBe(true);
      });
    });

    describe('index 0', () => {
      const fn = isDateCellWithinDateCellRangeFunction(0);

      it('should return false for the range 0-1000', () => {
        const result = fn({ i: 0, to: 1000 });
        expect(result).toBe(false);
      });

      it('should return true for the range 0-0', () => {
        const result = fn({ i: 0, to: 0 });
        expect(result).toBe(true);
      });
    });
  });
});

describe('filterDateCellsInDateCellRange()', () => {
  it('should filter values that are within the range.', () => {
    const range = { i: 0, to: 5 };
    const input = [{ i: 0 }, { i: 1 }, { i: 2 }];

    const result = filterDateCellsInDateCellRange(input, range);
    expect(result.length).toBe(input.length);
  });

  it('should filter DateCellRange values that are entirely within the range.', () => {
    const range = { i: 0, to: 5 };
    const input = [dateCellRange(0, 5), dateCellRange(2, 4)];

    const result = filterDateCellsInDateCellRange(input, range);
    expect(result.length).toBe(input.length);
  });

  it('should filter out values that are outside the range.', () => {
    const range = { i: 0, to: 5 };
    const input = [{ i: 6 }, { i: 7 }, { i: 8 }];

    const result = filterDateCellsInDateCellRange(input, range);
    expect(result.length).toBe(0);
  });

  it('should filter out DateCellRange values that are only partially within the range.', () => {
    const range = { i: 0, to: 5 };
    const input = dateCellRange(0, 10);

    const result = filterDateCellsInDateCellRange([input], range);
    expect(result.length).toBe(0);
  });
});

describe('groupToDateCellRanges()', () => {
  it('should group the input blocks that overlap eachother.', () => {
    const input = [dateCellRange(0, 4), dateCellRange(0, 4), dateCellRange(0, 4), dateCellRange(0, 4)];
    const result = groupToDateCellRanges(input);

    expect(result.length).toBe(1);
    expect(result[0].i).toBe(0);
    expect(result[0].to).toBe(4);
  });

  it('should group the input blocks that are contiguous but do not overlap.', () => {
    const input = [dateCellRange(0, 1), dateCellRange(2, 3), dateCellRange(4, 5), dateCellRange(6, 7)];
    const result = groupToDateCellRanges(input);

    expect(result.length).toBe(1);
    expect(result[0].i).toBe(0);
    expect(result[0].to).toBe(7);
  });

  it('should group the input blocks that are contiguous and overlap.', () => {
    const input = [dateCellRange(0, 5), dateCellRange(2, 3), dateCellRange(4, 7), dateCellRange(4, 9)];
    const result = groupToDateCellRanges(input);

    expect(result.length).toBe(1);
    expect(result[0].i).toBe(0);
    expect(result[0].to).toBe(9);
  });

  it('should only group the input blocks that are contiguous or overlap.', () => {
    const input = [dateCellRange(0, 2), dateCellRange(4, 7), dateCellRange(9, 12)];
    const result = groupToDateCellRanges(input);

    expect(result.length).toBe(3);
    expect(result[0].i).toBe(0);
    expect(result[0].to).toBe(2);

    expect(result[1].i).toBe(4);
    expect(result[1].to).toBe(7);

    expect(result[2].i).toBe(9);
    expect(result[2].to).toBe(12);
  });
});

describe('allIndexesInDateCellRanges()', () => {
  it('should return the indexes from all input DateCellRange values', () => {
    const a = { i: 0 };
    const b = { i: 1, to: 2 };

    const result = allIndexesInDateCellRanges([a, b]);

    expect(result).toContain(0);
    expect(result).toContain(1);
    expect(result).toContain(2);
  });

  it('should return the indexes from all input DateCellIndex values', () => {
    const result = allIndexesInDateCellRanges([0, 1, 2]);

    expect(result).toContain(0);
    expect(result).toContain(1);
    expect(result).toContain(2);
  });

  it('should return the indexes from a mix of DateCellRange values and index values', () => {
    const a = 0;
    const b = { i: 1, to: 2 };
    const result = allIndexesInDateCellRanges([a, b]);

    expect(result).toContain(0);
    expect(result).toContain(1);
    expect(result).toContain(2);
  });
});

describe('dateCellRangeBlocksCountInfo()', () => {
  it('should return the correct calculations for DateCell at index 100.', () => {
    const { count, total, average } = dateCellRangeBlocksCountInfo({ i: 100 });
    expect(count).toBe(1);
    expect(total).toBe(100);
    expect(average).toBe(100);
  });

  it('should return the correct calculations for a DateCellRange.', () => {
    const { count, total, average } = dateCellRangeBlocksCountInfo({ i: 51, to: 100 });
    expect(count).toBe(50); // 50 blocks
    expect(total).toBe(3775);
    expect(average).toBe(75.5);
  });
});

describe('dateCellRangeBlocksCount()', () => {
  it('should return 1 for a DateCell.', () => {
    const count = dateCellRangeBlocksCount({ i: 100 });
    expect(count).toBe(1);
  });

  it('should return 2 for two DateCells.', () => {
    const count = dateCellRangeBlocksCount([{ i: 100 }, { i: 101 }]);
    expect(count).toBe(2);
  });

  it('should return 1 for two DateCells that have the same value.', () => {
    const count = dateCellRangeBlocksCount([{ i: 100 }, { i: 100 }]);
    expect(count).toBe(1);
  });

  it('should return 10 for a DateCellRange.', () => {
    const count = dateCellRangeBlocksCount({ i: 5, to: 15 });
    expect(count).toBe(11); // 11 blocks
  });

  it('should return the sum of two unique DateCellRanges.', () => {
    const count = dateCellRangeBlocksCount([
      { i: 5, to: 15 }, // 11 blocks
      { i: 25, to: 35 } // 11 blocks
    ]);
    expect(count).toBe(22);
  });

  it('should return the unique blocks for DateCellRanges.', () => {
    const count = dateCellRangeBlocksCount([
      { i: 5, to: 10 }, // 6 blocks
      { i: 5, to: 15 } // 11 blocks
    ]);
    expect(count).toBe(11);
  });
});

describe('dateCellRangesFullyCoverDateCellRangeFunction()', () => {
  describe('function', () => {
    describe('single range', () => {
      const range = dateCellRange(5, 10);
      const fn = dateCellRangesFullyCoverDateCellRangeFunction(range);

      it('should return true for the same range.', () => {
        const result = fn(range);
        expect(result).toBe(true);
      });

      it('should return true for a range that is smaller and fully covered', () => {
        const result = fn(dateCellRange(5, 6));
        expect(result).toBe(true);
      });

      it('should return false for a range that is larger and not fully covered.', () => {
        const result = fn(dateCellRange(2, 12));
        expect(result).toBe(false);
      });

      it('should return false for a range that is smaller and not fully covered', () => {
        const result = fn(dateCellRange(1, 4));
        expect(result).toBe(false);
      });
    });

    describe('split range', () => {
      const rangeA = dateCellRange(1, 3);
      const rangeB = dateCellRange(5, 8);
      const fn = dateCellRangesFullyCoverDateCellRangeFunction([rangeA, rangeB]);

      it('should return true for rangeA.', () => {
        const result = fn(rangeA);
        expect(result).toBe(true);
      });

      it('should return true for rangeB.', () => {
        const result = fn(rangeB);
        expect(result).toBe(true);
      });

      it('should return false for a range that is larger and not fully covered.', () => {
        const result = fn(dateCellRange(1, 12));
        expect(result).toBe(false);
      });
    });

    describe('merged range', () => {
      const rangeA = dateCellRange(2, 4);
      const rangeB = dateCellRange(5, 10);
      const fn = dateCellRangesFullyCoverDateCellRangeFunction([rangeA, rangeB]);

      it('should return true for rangeA.', () => {
        const result = fn(rangeA);
        expect(result).toBe(true);
      });

      it('should return true for rangeB.', () => {
        const result = fn(rangeB);
        expect(result).toBe(true);
      });

      it('should return false for a range that is larger and not fully covered.', () => {
        const result = fn(dateCellRange(0, 12));
        expect(result).toBe(false);
      });

      it('should return false for a range that is smaller and not fully covered', () => {
        const result = fn(dateCellRange(1, 3));
        expect(result).toBe(false);
      });

      it('should return false for a range that is not fully covered', () => {
        const result = fn(dateCellRange(10, 12));
        expect(result).toBe(false);
      });
    });
  });
});

describe('getNextDateCellTimingIndex()', () => {
  it('should return the expected results', () => {
    const a = { i: 2, to: 3, x: 'a' };
    const b = { i: 6, to: 8, x: 'b' };
    const c = { i: 9, to: 12, x: 'c' };
    const d = { i: 20, to: 28, x: 'd' };
    const ranges = [a, b, c, d];

    const resultA = getNextDateCellTimingIndex({ currentIndex: 0, ranges });
    expect(resultA.currentResult).toBeUndefined();
    expect(resultA.nextIndex).toBe(2);
    expect(resultA.nextResult).toBeDefined();
    expect(resultA.nextResult?.x).toBe(a.x);

    const resultB = getNextDateCellTimingIndex({ currentIndex: 6, ranges });
    expect(resultB.currentResult).toBeDefined();
    expect(resultB.currentResult?.x).toBe(b.x);
    expect(resultB.nextIndex).toBe(7);
    expect(resultB.nextResult).toBeDefined();
    expect(resultB.nextResult?.x).toBe(b.x);

    const resultC = getNextDateCellTimingIndex({ currentIndex: 8, ranges });
    expect(resultC.currentResult).toBeDefined();
    expect(resultC.currentResult?.x).toBe(b.x);
    expect(resultC.nextIndex).toBe(9);
    expect(resultC.nextResult).toBeDefined();
    expect(resultC.nextResult?.x).toBe(c.x);

    const resultD = getNextDateCellTimingIndex({ currentIndex: 12, ranges });
    expect(resultD.currentResult).toBeDefined();
    expect(resultD.currentResult?.x).toBe(c.x);
    expect(resultD.nextIndex).toBe(d.i);
    expect(resultD.nextResult).toBeDefined();
    expect(resultD.nextResult?.x).toBe(d.x);

    const resultE = getNextDateCellTimingIndex({ currentIndex: 30, ranges });
    expect(resultE.currentResult).toBeUndefined();
    expect(resultE.nextResult).toBeUndefined();
    expect(resultE.nextIndex).toBeUndefined();
  });

  it('should return no results if the input is an empty array', () => {
    const result = getNextDateCellTimingIndex({ currentIndex: 0, ranges: [] });

    expect(result.currentResult).toBeUndefined();
    expect(result.nextResult).toBeUndefined();
    expect(result.pastResults.length).toBe(0);
    expect(result.presentResults.length).toBe(0);
    expect(result.futureResults.length).toBe(0);
  });
});

describe('dateRelativeStateForDateCellIndexAndDateCellRange()', () => {
  it('should return past for ranges less than the index.', () => {
    const result = dateRelativeStateForDateCellRangeComparedToIndex({ i: 0, to: 2 }, 3);
    expect(result).toBe('past');
  });

  it('should return future for ranges greater than the index.', () => {
    const result = dateRelativeStateForDateCellRangeComparedToIndex({ i: 2, to: 2 }, 1);
    expect(result).toBe('future');
  });

  it('should return present for ranges that contain the index.', () => {
    const result = dateRelativeStateForDateCellRangeComparedToIndex({ i: 0, to: 2 }, 1);
    expect(result).toBe('present');
  });

  it('should return present for ranges that have the same i value.', () => {
    const result = dateRelativeStateForDateCellRangeComparedToIndex({ i: 0, to: 2 }, 0);
    expect(result).toBe('present');
  });

  it('should return present for ranges that have the same to value.', () => {
    const result = dateRelativeStateForDateCellRangeComparedToIndex({ i: 0, to: 2 }, 2);
    expect(result).toBe('present');
  });
});

describe('expandDateCellRange', () => {
  it('should copy the input block and spread it over a range.', () => {
    const lastIndex = 5;
    const blocksRange = { i: 0, to: 5, value: 'a' };

    const result = expandDateCellRange(blocksRange);
    expect(result.length).toBe(lastIndex + 1);
    result.forEach((x, i) => {
      expect(x.i).toBe(i);
      expect(x.value).toBe(blocksRange.value);
    });
  });
});

interface UniqueDataDateCell extends UniqueDateCellRange {
  value: string;
}

function block(i: number, to?: number, id?: string | undefined) {
  return blockForIdFactory(id)(i, to);
}

function blockForIdFactory(id: string | undefined): (i: number, to?: number) => UniqueDataDateCell {
  return (i: number, to?: number) => {
    return { id, i, to, value: `${i}-${to ?? i}` };
  };
}

function blocks(i: number, to: number): UniqueDataDateCell[] {
  return range(i, to).map((x) => block(x));
}

const startAtIndex = 2;
const endAtIndex = 3;

const noBlocks: UniqueDataDateCell[] = blocks(0, 0);
const contiguousBlocks: UniqueDataDateCell[] = blocks(0, 5);
const blocksWithMiddleGap: UniqueDataDateCell[] = [block(0, 1), block(4, 5)];
const blocksWithStartGap: UniqueDataDateCell[] = [block(startAtIndex + 1, 5)];
const blocksWithEndGap: UniqueDataDateCell[] = [block(0, endAtIndex - 1)];
const blocksBeforeStartAtIndex: UniqueDataDateCell[] = [block(0, startAtIndex - 1)];
const blocksAfterEndAtIndex: UniqueDataDateCell[] = [block(endAtIndex + 1, endAtIndex + 5)];
const overlappingBlocksAtSameIndex: UniqueDataDateCell[] = [block(0, 0, 'a'), block(0, 0, 'b')];
const overlappingBlocksAtSameRange: UniqueDataDateCell[] = [block(0, 5, 'a'), block(0, 5, 'b')];
const overlappingBlocksAtDifferentRange: UniqueDataDateCell[] = [block(0, 3, 'a'), block(2, 5, 'b')];
const overlappingBlocksFirstEclipseSecond: UniqueDataDateCell[] = [block(0, 3, 'a'), block(2, 3, 'b')];

const manyOverlappingBlocksAtSameIndex: UniqueDataDateCell[] = [block(0, 0, 'a'), block(0, 0, 'b'), block(0, 0, 'c'), block(0, 0, 'd')];
const manyOverlappingBlocksAtSameRange: UniqueDataDateCell[] = [block(0, 5, 'a'), block(0, 5, 'b'), block(0, 5, 'c'), block(0, 5, 'd')];

describe('groupUniqueDateCells()', () => {
  it('should return the blocks sorted by index', () => {
    const result = groupUniqueDateCells(contiguousBlocks);
    expect(result.i).toBe(0);
    expect(result.to).toBe(4);

    contiguousBlocks.forEach((x, i) => expect(result.blocks[i].value).toBe(x.value));
  });
});

describe('expandUniqueDateCellsFunction', () => {
  describe('function', () => {
    describe('overwrite', () => {
      describe('next', () => {
        const overwriteNextExpand = expandUniqueDateCellsFunction<UniqueDataDateCell>({ retainOnOverlap: 'next', fillOption: 'extend' });

        describe('with index', () => {
          it('should use the latter value to overwrite the previous value', () => {
            const result = overwriteNextExpand(overlappingBlocksAtSameIndex);

            expect(result.blocks.length).toBe(1);
            expect(result.discarded.length).toBe(1);
            expect(result.discarded[0].id).toBe(overlappingBlocksAtSameIndex[0].id);
            expect(result.blocks[0].id).toBe(overlappingBlocksAtSameIndex[1].id);
          });

          it('should use the latter value out of many to overwrite the previous value', () => {
            const result = overwriteNextExpand(manyOverlappingBlocksAtSameIndex);

            expect(result.blocks.length).toBe(1);
            expect(result.discarded.length).toBe(3);
            expect(result.discarded[0].id).toBe(manyOverlappingBlocksAtSameIndex[0].id);
            expect(result.discarded[1].id).toBe(manyOverlappingBlocksAtSameIndex[1].id);
            expect(result.discarded[2].id).toBe(manyOverlappingBlocksAtSameIndex[2].id);
            expect(result.blocks[0].id).toBe(manyOverlappingBlocksAtSameIndex[3].id);
          });
        });

        describe('with range', () => {
          it('should use the latter value to overwrite the previous value', () => {
            const result = overwriteNextExpand(overlappingBlocksAtSameRange);

            expect(result.blocks.length).toBe(1);
            expect(result.discarded.length).toBe(1);
            expect(result.discarded[0].id).toBe(overlappingBlocksAtSameRange[0].id);
            expect(result.blocks[0].id).toBe(overlappingBlocksAtSameRange[1].id);
          });

          it('should use the latter value out of many to overwrite the previous value', () => {
            const result = overwriteNextExpand(manyOverlappingBlocksAtSameRange);

            expect(result.blocks.length).toBe(1);
            expect(result.discarded.length).toBe(3);
            expect(result.discarded[0].id).toBe(manyOverlappingBlocksAtSameRange[0].id);
            expect(result.discarded[1].id).toBe(manyOverlappingBlocksAtSameRange[1].id);
            expect(result.discarded[2].id).toBe(manyOverlappingBlocksAtSameRange[2].id);
            expect(result.blocks[0].id).toBe(manyOverlappingBlocksAtSameRange[3].id);
          });
        });

        describe('with overlapping ranges', () => {
          it('the former value should end before the start of the newer value', () => {
            const result = overwriteNextExpand(overlappingBlocksAtDifferentRange);

            expect(result.blocks.length).toBe(2);
            expect(result.discarded.length).toBe(0);
            expect(result.blocks[0].id).toBe(overlappingBlocksAtDifferentRange[0].id);
            expect(result.blocks[1].id).toBe(overlappingBlocksAtDifferentRange[1].id);
            expect(result.blocks[0].to).toBe(overlappingBlocksAtDifferentRange[1].i! - 1);
            expect(result.blocks[1].i).toBe(overlappingBlocksAtDifferentRange[1].i);
            expect(result.blocks[1].to).toBe(overlappingBlocksAtDifferentRange[1].to);
          });
        });

        describe('with first eclipsing second', () => {
          it('the former value should end before the start of the newer value', () => {
            const result = overwriteNextExpand(overlappingBlocksFirstEclipseSecond);

            expect(result.blocks.length).toBe(2);
            expect(result.discarded.length).toBe(0);
            expect(result.blocks[0].id).toBe(overlappingBlocksFirstEclipseSecond[0].id);
            expect(result.blocks[1].id).toBe(overlappingBlocksFirstEclipseSecond[1].id);
            expect(result.blocks[0].to).toBe(overlappingBlocksFirstEclipseSecond[1].i! - 1);
            expect(result.blocks[1].i).toBe(overlappingBlocksFirstEclipseSecond[1].i);
            expect(result.blocks[1].to).toBe(overlappingBlocksFirstEclipseSecond[1].to);
          });

          describe('with endAtIndex', () => {
            const endAtIndex = 1; // use endAtIndex=1 for these tests
            const overwriteNextWithEndIndexExpand = expandUniqueDateCellsFunction<UniqueDataDateCell>({
              //
              endAtIndex,
              retainOnOverlap: 'next',
              fillOption: 'extend'
            });

            it('the former value should only exist', () => {
              const result = overwriteNextWithEndIndexExpand(overlappingBlocksFirstEclipseSecond);

              expect(result.blocks.length).toBe(1);
              expect(result.discarded.length).toBe(1);
              expect(result.blocks[0].id).toBe(overlappingBlocksFirstEclipseSecond[0].id);
              expect(result.discarded[0].id).toBe(overlappingBlocksFirstEclipseSecond[1].id);
              expect(result.blocks[0].i).toBe(overlappingBlocksFirstEclipseSecond[0].i);
              expect(result.blocks[0].to).toBe(endAtIndex);
            });
          });
        });

        describe('with larger first followed by smaller', () => {
          it('should start with the new value and end with the former value.', () => {
            const blocks = [
              { i: 0, to: 5, value: 'a' },
              { i: 0, value: 'b' }
            ];
            const result = overwriteNextExpand(blocks);

            expect(result.blocks.length).toBe(2);
            expect(result.discarded.length).toBe(0);
            expect(result.blocks[0].value).toBe(blocks[1].value);
            expect(result.blocks[1].value).toBe(blocks[0].value);
            expect(result.blocks[0].i).toBe(blocks[1].i);
            expect(result.blocks[0].to).toBe(blocks[1].to ?? 0);
            expect(result.blocks[1].i).toBe(blocks[1].i + 1);
            expect(result.blocks[1].to).toBe(blocks[0].to);
          });
        });
      });

      describe('current', () => {
        const overwriteNextExpand = expandUniqueDateCellsFunction<UniqueDataDateCell>({ retainOnOverlap: 'current', fillOption: 'extend' });

        describe('with index', () => {
          it('should use the former value and ignore the latter value', () => {
            const result = overwriteNextExpand(overlappingBlocksAtSameIndex);

            expect(result.blocks.length).toBe(1);
            expect(result.discarded.length).toBe(1);
            expect(result.discarded[0].id).toBe(overlappingBlocksAtSameIndex[1].id);
            expect(result.blocks[0].id).toBe(overlappingBlocksAtSameIndex[0].id);
          });

          it('should use the former value out of many to overwrite the previous value', () => {
            const result = overwriteNextExpand(manyOverlappingBlocksAtSameIndex);

            expect(result.blocks.length).toBe(1);
            expect(result.discarded.length).toBe(3);
            expect(result.discarded[0].id).toBe(manyOverlappingBlocksAtSameIndex[1].id);
            expect(result.discarded[1].id).toBe(manyOverlappingBlocksAtSameIndex[2].id);
            expect(result.discarded[2].id).toBe(manyOverlappingBlocksAtSameIndex[3].id);
            expect(result.blocks[0].id).toBe(manyOverlappingBlocksAtSameIndex[0].id);
          });
        });

        describe('with range', () => {
          it('should use the former value and ignore the latter value', () => {
            const result = overwriteNextExpand(overlappingBlocksAtSameRange);

            expect(result.blocks.length).toBe(1);
            expect(result.discarded.length).toBe(1);
            expect(result.discarded[0].id).toBe(overlappingBlocksAtSameRange[1].id);
            expect(result.blocks[0].id).toBe(overlappingBlocksAtSameRange[0].id);
          });

          it('should use the former value out of many to overwrite the previous value', () => {
            const result = overwriteNextExpand(manyOverlappingBlocksAtSameRange);

            expect(result.blocks.length).toBe(1);
            expect(result.discarded.length).toBe(3);
            expect(result.discarded[0].id).toBe(manyOverlappingBlocksAtSameRange[1].id);
            expect(result.discarded[1].id).toBe(manyOverlappingBlocksAtSameRange[2].id);
            expect(result.discarded[2].id).toBe(manyOverlappingBlocksAtSameRange[3].id);
            expect(result.blocks[0].id).toBe(manyOverlappingBlocksAtSameRange[0].id);
          });
        });

        describe('with overlapping range', () => {
          it('the newer value should start after the end of the older value', () => {
            const result = overwriteNextExpand(overlappingBlocksAtDifferentRange);

            expect(result.blocks.length).toBe(2);
            expect(result.discarded.length).toBe(0);
            expect(result.blocks[0].id).toBe(overlappingBlocksAtDifferentRange[0].id);
            expect(result.blocks[1].id).toBe(overlappingBlocksAtDifferentRange[1].id);
            expect(result.blocks[0].i).toBe(overlappingBlocksAtDifferentRange[0].i);
            expect(result.blocks[0].to).toBe(overlappingBlocksAtDifferentRange[0].to);
            expect(result.blocks[1].i).toBe(overlappingBlocksAtDifferentRange[0].to! + 1);
            expect(result.blocks[1].to).toBe(overlappingBlocksAtDifferentRange[1].to);
          });
        });

        describe('with first eclipsing second', () => {
          it('the former value should eclipse the second', () => {
            const result = overwriteNextExpand(overlappingBlocksFirstEclipseSecond);

            expect(result.blocks.length).toBe(1);
            expect(result.discarded.length).toBe(1);
            expect(result.blocks[0].id).toBe(overlappingBlocksFirstEclipseSecond[0].id);
            expect(result.discarded[0].id).toBe(overlappingBlocksFirstEclipseSecond[1].id);
            expect(result.blocks[0].i).toBe(overlappingBlocksFirstEclipseSecond[0].i);
            expect(result.blocks[0].to).toBe(overlappingBlocksFirstEclipseSecond[0].to);
          });

          describe('with endAtIndex', () => {
            const endAtIndex = 1; // use endAtIndex=1 for these tests
            const overwriteNextWithEndIndexExpand = expandUniqueDateCellsFunction<UniqueDataDateCell>({ endAtIndex, retainOnOverlap: 'current', fillOption: 'extend' });

            it('the former value should only matter and eclipse the second', () => {
              const result = overwriteNextWithEndIndexExpand(overlappingBlocksFirstEclipseSecond);

              expect(result.blocks.length).toBe(1);
              expect(result.discarded.length).toBe(1);
              expect(result.blocks[0].id).toBe(overlappingBlocksFirstEclipseSecond[0].id);
              expect(result.discarded[0].id).toBe(overlappingBlocksFirstEclipseSecond[1].id);
              expect(result.blocks[0].i).toBe(overlappingBlocksFirstEclipseSecond[0].i);
              expect(result.blocks[0].to).toBe(endAtIndex);
            });
          });
        });

        describe('with larger first followed by smaller', () => {
          it('current value should be retained.', () => {
            const blocks = [
              { i: 0, to: 5, value: 'a' },
              { i: 0, value: 'b' }
            ];
            const result = overwriteNextExpand(blocks);

            expect(result.blocks.length).toBe(1);
            expect(result.discarded.length).toBe(1);
            expect(result.discarded[0].value).toBe(blocks[1].value);
            expect(result.blocks[0].value).toBe(blocks[0].value);
            expect(result.blocks[0].i).toBe(blocks[0].i);
            expect(result.blocks[0].to).toBe(blocks[0].to);
          });
        });
      });
    });

    describe('fillOption', () => {
      describe('fill', () => {
        const fillOptionExpand = expandUniqueDateCellsFunction<UniqueDataDateCell>({ fillOption: 'fill', fillFactory: (x) => ({ ...x, value: 'new' }) });

        itShouldFail('if fillFactory is not provided.', () => {
          expectFail(() => expandUniqueDateCellsFunction({ fillOption: 'fill' }));
        });

        it('should create a gap block for middle gaps', () => {
          const result = fillOptionExpand(blocksWithMiddleGap);

          expect(result.discarded.length).toBe(0);
          expect(result.blocks.length).toBe(blocksWithMiddleGap.length + 1);
          expect(result.blocks[1].i).toBe(blocksWithMiddleGap[0].to! + 1);
          expect(result.blocks[1].to).toBe(blocksWithMiddleGap[1].i - 1);
        });

        it('should create a gap block for start gaps', () => {
          const result = fillOptionExpand(blocksWithStartGap);

          expect(result.discarded.length).toBe(0);
          expect(result.blocks.length).toBe(blocksWithStartGap.length + 1);
          expect(result.blocks[0].i).toBe(0);
          expect(result.blocks[0].to).toBe(blocksWithStartGap[0].i! - 1);
          expect(result.blocks[1].i).toBe(blocksWithStartGap[0].i);
          expect(result.blocks[1].to).toBe(blocksWithStartGap[0].to);
        });

        it('should not create a gap block for end gaps', () => {
          const result = fillOptionExpand(blocksWithEndGap);

          expect(result.discarded.length).toBe(0);
          expect(result.blocks.length).toBe(blocksWithEndGap.length);
        });

        it('should not create a gap block for contiguous blocks', () => {
          const result = fillOptionExpand(contiguousBlocks);

          expect(result.discarded.length).toBe(0);
          expect(result.blocks.length).toBe(contiguousBlocks.length);

          contiguousBlocks.forEach((x, i) => expect(result.blocks[i].value).toBe(x.value));
        });

        it('should not create a gap block for no blocks', () => {
          const result = fillOptionExpand(noBlocks);

          expect(result.discarded.length).toBe(0);
          expect(result.blocks.length).toBe(noBlocks.length);
        });

        describe('with endAtIndex', () => {
          const fillOptionExpandBlocksWithEndAtIndex = expandUniqueDateCellsFunction<UniqueDataDateCell>({ endAtIndex, fillOption: 'fill', fillFactory: (x) => ({ ...x, value: 'new' }) });

          it('should create a gap block for end gaps', () => {
            const result = fillOptionExpandBlocksWithEndAtIndex(blocksWithEndGap);

            expect(result.discarded.length).toBe(0);
            expect(result.blocks.length).toBe(blocksWithEndGap.length + 1);
            expect(result.blocks[1].i).toBe(blocksWithEndGap[0].to! + 1);
            expect(result.blocks[1].to).toBe(endAtIndex);
          });

          describe('block that starts after the endAtIndex', () => {
            it('should create a gap block from 0 to endIndex range and discard the input', () => {
              const result = fillOptionExpandBlocksWithEndAtIndex(blocksAfterEndAtIndex);

              expect(result.discarded.length).toBe(1);
              expect(result.blocks.length).toBe(1);
              expect(result.blocks[0].i).toBe(0);
              expect(result.blocks[0].to).toBe(endAtIndex);
            });
          });
        });

        describe('with startAtIndex and endAtIndex', () => {
          const fillOptionExpandBlocksWithStartAndEnd = expandUniqueDateCellsFunction<UniqueDataDateCell>({ startAtIndex, endAtIndex, fillOption: 'fill', fillFactory: (x) => ({ ...x, value: 'new' }) });

          describe('block that starts after the endAtIndex', () => {
            it('should create a gap block for the startIndex to endIndex range and discard the input', () => {
              const result = fillOptionExpandBlocksWithStartAndEnd(blocksAfterEndAtIndex);

              expect(result.discarded.length).toBe(1);
              expect(result.blocks.length).toBe(1);
              expect(result.blocks[0].i).toBe(startAtIndex);
              expect(result.blocks[0].to).toBe(endAtIndex);
            });
          });

          describe('no blocks as input', () => {
            it('should create a gap block for the startIndex to endIndex range', () => {
              const result = fillOptionExpandBlocksWithStartAndEnd(noBlocks);

              expect(result.discarded.length).toBe(0);
              expect(result.blocks.length).toBe(1);
              expect(result.blocks[0].i).toBe(startAtIndex);
              expect(result.blocks[0].to).toBe(endAtIndex);
            });
          });
        });
      });

      describe('extend', () => {
        const expandOptionExpandBlocks = expandUniqueDateCellsFunction<UniqueDataDateCell>({ fillOption: 'extend' });

        it('should not extend the first block to stretch to the start', () => {
          const result = expandOptionExpandBlocks(blocksWithStartGap);

          expect(result.discarded.length).toBe(0);
          expect(result.blocks.length).toBe(blocksWithStartGap.length);
          expect(result.blocks[0].i).toBe(blocksWithStartGap[0].i);
          expect(result.blocks[0].to).toBe(blocksWithStartGap[0].to);
        });

        it('should extend to fill for middle gaps', () => {
          const result = expandOptionExpandBlocks(blocksWithMiddleGap);

          expect(result.discarded.length).toBe(0);
          expect(result.blocks.length).toBe(blocksWithMiddleGap.length);
          expect(result.blocks[0].i).toBe(blocksWithMiddleGap[0].i);
          expect(result.blocks[0].to).toBe(blocksWithMiddleGap[1].i - 1);
          expect(result.blocks[1].i).toBe(blocksWithMiddleGap[1].i);
          expect(result.blocks[1].to).toBe(blocksWithMiddleGap[1].to);
        });

        it('should not extend the end gap as there is no known end', () => {
          const result = expandOptionExpandBlocks(blocksWithEndGap);

          expect(result.discarded.length).toBe(0);
          expect(result.blocks.length).toBe(blocksWithEndGap.length);
          expect(result.blocks[0].i).toBe(blocksWithEndGap[0].i);
          expect(result.blocks[0].to).toBe(blocksWithEndGap[0].to);
        });

        describe('with endAtIndex', () => {
          const expandOptionWithEndIndexExpandBlocks = expandUniqueDateCellsFunction<UniqueDataDateCell>({ endAtIndex, fillOption: 'extend' });

          describe('block that starts after the endAtIndex', () => {
            it('should filter that block out and return nothing.', () => {
              const result = expandOptionWithEndIndexExpandBlocks(blocksAfterEndAtIndex);

              expect(result.discarded.length).toBe(1);
              expect(result.blocks.length).toBe(0);
            });
          });

          it('should expand the last value to the end block.', () => {
            const result = expandOptionWithEndIndexExpandBlocks(blocksWithEndGap);

            expect(result.discarded.length).toBe(0);
            expect(result.blocks.length).toBe(blocksWithEndGap.length);
            expect(result.blocks[0].i).toBe(blocksWithEndGap[0].i);
            expect(result.blocks[0].to).toBe(endAtIndex);
          });
        });

        describe('with startAt and endAt index', () => {
          const expandOptionWithStartAndEndIndexExpandBlocks = expandUniqueDateCellsFunction<UniqueDataDateCell>({ startAtIndex, endAtIndex, fillOption: 'extend' });

          describe('block that starts after the endAtIndex', () => {
            it('should filter that block out and return nothing.', () => {
              const result = expandOptionWithStartAndEndIndexExpandBlocks(blocksAfterEndAtIndex);

              expect(result.discarded.length).toBe(1);
              expect(result.blocks.length).toBe(0);
            });
          });

          describe('block that ends before the startAtIndex', () => {
            it('should filter that block out and return nothing.', () => {
              const result = expandOptionWithStartAndEndIndexExpandBlocks(blocksBeforeStartAtIndex);

              expect(result.discarded.length).toBe(1);
              expect(result.blocks.length).toBe(0);
            });
          });

          describe('no blocks as input', () => {
            it('should return no blocks', () => {
              const result = expandOptionWithStartAndEndIndexExpandBlocks(noBlocks);

              expect(result.discarded.length).toBe(0);
              expect(result.blocks.length).toBe(0);
            });
          });
        });
      });
    });

    describe('scenarios', () => {
      it('should expand the blocks and not infinitely loop if another block comes after that has a 0-0 range.', async () => {
        const i = 0;
        const to = 2;

        const allBlocks: any[] = [
          {
            i: 0,
            to: 2
          },
          { i: 0, to: undefined }
        ];

        const requestedRangeBlocks = expandUniqueDateCellsFunction({
          startAtIndex: i,
          endAtIndex: to,
          fillOption: 'fill',
          retainOnOverlap: 'next',
          fillFactory: (x) => x
        })(allBlocks);

        expect(requestedRangeBlocks.blocks).toBeDefined();
        expect(requestedRangeBlocks.blocks.length).toBe(2);
        expect(requestedRangeBlocks.blocks[0].i).toBe(0);
        expect(requestedRangeBlocks.blocks[0].to).toBe(0);
        expect(requestedRangeBlocks.blocks[1].i).toBe(1);
        expect(requestedRangeBlocks.blocks[1].to).toBe(2);
      });

      it('should replace the current block with the next block.', async () => {
        const i = 0;
        const to = 5;

        const allBlocks = [
          {
            i: 3,
            to: 4,
            value: 'overwrite me'
          },
          { i: 4, to: 4, value: 'canceled with' }
        ];

        const requestedRangeBlocks = expandUniqueDateCellsFunction({
          startAtIndex: i,
          endAtIndex: to,
          fillOption: 'fill',
          retainOnOverlap: 'next',
          fillFactory: (x) => x
        })(allBlocks);

        expect(requestedRangeBlocks.blocks).toBeDefined();
        expect(requestedRangeBlocks.blocks.length).toBe(4);
        expect(requestedRangeBlocks.blocks[0].i).toBe(0);
        expect(requestedRangeBlocks.blocks[0].to).toBe(allBlocks[0].i - 1);
        expect(requestedRangeBlocks.blocks[1].i).toBe(allBlocks[0].i);
        expect(requestedRangeBlocks.blocks[1].to).toBe(allBlocks[0].i);
        expect(requestedRangeBlocks.blocks[2].i).toBe(allBlocks[1].i);
        expect(requestedRangeBlocks.blocks[2].to).toBe(allBlocks[1].i);
        expect(requestedRangeBlocks.blocks[3].i).toBe(5);
        expect(requestedRangeBlocks.blocks[3].to).toBe(5);
      });

      it('should replace the current block with the next block that extends before the current block.', async () => {
        const i = 0;
        const to = 5;

        const allBlocks = [
          {
            i: 3,
            to: 4,
            value: 'overwrite me'
          }
        ];

        // this one comes "next", and below will prefer it to exist.
        const nextBlocks = [{ i: 2, to: 4, value: 'canceled with' }];

        const requestedRangeBlocks = expandUniqueDateCellsFunction({
          startAtIndex: i,
          endAtIndex: to,
          fillOption: 'fill',
          retainOnOverlap: 'next',
          fillFactory: (x) => x
        })(allBlocks, nextBlocks);

        expect(requestedRangeBlocks.blocks).toBeDefined();
        expect(requestedRangeBlocks.blocks.length).toBe(3);
        expect(requestedRangeBlocks.blocks[0].i).toBe(0);
        expect(requestedRangeBlocks.blocks[0].to).toBe(nextBlocks[0].i - 1);
        expect(requestedRangeBlocks.blocks[1].i).toBe(nextBlocks[0].i);
        expect(requestedRangeBlocks.blocks[1].to).toBe(nextBlocks[0].to);
        expect(requestedRangeBlocks.blocks[2].i).toBe(5);
        expect(requestedRangeBlocks.blocks[2].to).toBe(5);
      });

      it('should replace all current blocks with the next block.', async () => {
        const i = 0;
        const to = 5;

        const currentBlocks = range(i, to + 1).map((x) => ({ i: x, to: x, value: 'replace me' }));

        // this one comes "next", and below will prefer it to exist.
        const nextBlocks = [{ i: 0, to: 5, value: 'retained next' }];

        const requestedRangeBlocks = expandUniqueDateCellsFunction({
          startAtIndex: i,
          endAtIndex: to,
          fillOption: 'fill',
          retainOnOverlap: 'next',
          fillFactory: (x) => ({ ...x, value: 'a' })
        })(currentBlocks, nextBlocks);

        expect(requestedRangeBlocks.blocks).toBeDefined();
        expect(requestedRangeBlocks.blocks.length).toBe(1);
        expect(requestedRangeBlocks.blocks[0].i).toBe(0);
        expect(requestedRangeBlocks.blocks[0].to).toBe(nextBlocks[0].to);

        currentBlocks.forEach((block, i) => {
          expect(requestedRangeBlocks.discarded[i].i).toBe(block.i);
        });
      });

      it('should retain all current blocks over the next block.', async () => {
        const i = 0;
        const to = 5;

        const currentBlocks = range(i, to + 1).map((x) => ({ i: x, to: x, value: 'retain current' }));

        // this one comes "next", and below will prefer it to exist.
        const nextBlocks = [{ i: 0, to: 5, value: 'skip me' }];

        const requestedRangeBlocks = expandUniqueDateCellsFunction({
          startAtIndex: i,
          endAtIndex: to,
          fillOption: 'fill',
          retainOnOverlap: 'current',
          fillFactory: (x) => ({ ...x, value: 'a' })
        })(currentBlocks, nextBlocks);

        expect(requestedRangeBlocks.blocks).toBeDefined();
        expect(requestedRangeBlocks.discarded).toBeDefined();
        expect(requestedRangeBlocks.discarded.length).toBe(1);

        // discarded range might not be the same range that entered, but values/ids will be retained
        expect(requestedRangeBlocks.discarded[0].value).toBe(nextBlocks[0].value);

        expect(requestedRangeBlocks.blocks.length).toBe(currentBlocks.length);
        currentBlocks.forEach((block, i) => {
          expect(requestedRangeBlocks.blocks[i].i).toBe(block.i);
        });
      });

      it('should replace the next block with the current block that extends before the current block.', async () => {
        const i = 0;
        const to = 5;

        const currentBlocks = [
          {
            i: 3,
            to: 4,
            value: 'retain me'
          }
        ];

        // this one comes "next", and below will prefer it to exist.
        const nextBlocks = [{ i: 2, to: 4, value: 'overwrite empty area' }];

        const filledValue = 'filled value';

        const requestedRangeBlocks = expandUniqueDateCellsFunction<typeof currentBlocks[0]>({
          startAtIndex: i,
          endAtIndex: to,
          fillOption: 'fill',
          retainOnOverlap: 'current',
          fillFactory: (x) => ({ ...x, value: filledValue })
        })(currentBlocks, nextBlocks);

        expect(requestedRangeBlocks.blocks).toBeDefined();
        expect(requestedRangeBlocks.blocks.length).toBe(4);
        expect(requestedRangeBlocks.blocks[0].i).toBe(0);
        expect(requestedRangeBlocks.blocks[0].to).toBe(nextBlocks[0].i - 1);
        expect(requestedRangeBlocks.blocks[0].value).toBe(filledValue);
        expect(requestedRangeBlocks.blocks[1].i).toBe(nextBlocks[0].i);
        expect(requestedRangeBlocks.blocks[1].to).toBe(nextBlocks[0].i);
        expect(requestedRangeBlocks.blocks[1].value).toBe(nextBlocks[0].value);
        expect(requestedRangeBlocks.blocks[2].i).toBe(currentBlocks[0].i);
        expect(requestedRangeBlocks.blocks[2].to).toBe(currentBlocks[0].to);
        expect(requestedRangeBlocks.blocks[2].value).toBe(currentBlocks[0].value);
        expect(requestedRangeBlocks.blocks[3].i).toBe(5);
        expect(requestedRangeBlocks.blocks[3].to).toBe(5);
        expect(requestedRangeBlocks.blocks[3].value).toBe(filledValue);
      });

      it(`should split a block and retain its attributes.`, async () => {
        const i = 0;
        const to = 5;

        const allBlocks = [
          {
            i: 0,
            to: 5,
            value: 'retain'
          }
        ];

        const cancelledBlocks = [
          {
            i: 1,
            to: 1,
            value: 'cancel'
          }
        ];

        const requestedRangeBlocks = expandUniqueDateCellsFunction<typeof cancelledBlocks[0]>({
          startAtIndex: i,
          endAtIndex: to,
          fillOption: 'fill',
          retainOnOverlap: 'next',
          fillFactory: (x) => ({ ...x, value: 'new' })
        })(allBlocks, cancelledBlocks);

        expect(requestedRangeBlocks.blocks).toBeDefined();
        expect(requestedRangeBlocks.blocks.length).toBe(3);
        expect(requestedRangeBlocks.blocks[0].i).toBe(0);
        expect(requestedRangeBlocks.blocks[0].to).toBe(0);
        expect(requestedRangeBlocks.blocks[0].value).toBe(allBlocks[0].value);
        expect(requestedRangeBlocks.blocks[1].i).toBe(1);
        expect(requestedRangeBlocks.blocks[1].to).toBe(1);
        expect(requestedRangeBlocks.blocks[1].value).toBe(cancelledBlocks[0].value);
        expect(requestedRangeBlocks.blocks[2].i).toBe(2);
        expect(requestedRangeBlocks.blocks[2].to).toBe(to);
        expect(requestedRangeBlocks.blocks[2].value).toBe(allBlocks[0].value);
      });
    });
  });
});
