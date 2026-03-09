import { type Maybe, type SortCompareFunction, sortAscendingIndexNumberRefFunction, type RequiredOnKeys, type ArrayOrValue, asArray, sumOfIntegersBetween, type UniqueModel, type IndexNumber, lastValue, type FactoryWithRequiredInput, pushArrayItemsIntoArray, range, type DateRelativeState, makeValuesGroupMap } from '@dereekb/util';
import { type DateCell, isValidDateCellIndex, type DateOrDateCellIndex, type DateCellIndex } from './date.cell';
import { type DateRange } from './date.range';

// MARK: DateCellRange
/**
 * Represents a range of DateCell values.
 */
export interface DateCellRange extends DateCell {
  /**
   * Index this block ends at, inclusive. A block with i=0 and to=0 encompases only the block 0.
   *
   * If not provided, assumes this has no range and starts/ends at the same index, i.
   */
  to?: DateCellIndex;
}

/**
 * Returns true if the input is a DateCellRange.
 *
 * Does not check validity. Use {@link isValidDateCellRange} for that.
 *
 * @param input - value to check
 */
export function isDateCellRange(input: unknown): input is DateCellRange {
  return typeof input === 'object' ? (Number.isInteger((input as DateCellRange).i) && (input as DateCellRange).to === undefined) || Number.isInteger((input as DateCellRange).to) : false;
}

/**
 * A DateCellIndex, DateCell, or DateCellRange
 */
export type DateCellOrDateCellIndexOrDateCellRange = DateCellIndex | DateCell | DateCellRange;

/**
 * Returns true if the input is a valid DateCellRange.
 *
 * A valid range has a non-negative integer `i`, and if `to` is defined it must also be a valid index
 * that is greater than or equal to `i`.
 *
 * @param input - range to validate
 */
export function isValidDateCellRange(input: DateCellRange): boolean {
  const { i, to } = input;

  if (!isValidDateCellIndex(i)) {
    return false;
  } else if (to != null && (!isValidDateCellIndex(to) || to < i)) {
    return false;
  }

  return true;
}

/**
 * Returns true if the input is a sorted DateCellRange array and there are no repeat indexes.
 *
 * Validates that each range is individually valid and that no ranges overlap or appear out of order.
 *
 * @param input - array of ranges to validate as a non-overlapping ascending series
 */
export function isValidDateCellRangeSeries(input: DateCellRange[]): boolean {
  if (!Array.isArray(input)) {
    return false;
  }

  const invalidRange = input.findIndex((range) => !isValidDateCellRange(range));

  if (invalidRange !== -1) {
    return false;
  }

  let greatestIndex = -1;

  for (let i = 0; i < input.length; i += 1) {
    const range = input[i];

    if (range.i <= greatestIndex) {
      return false;
    } else {
      const nextGreatestIndex = range.to || range.i; // to is greater than or equal to i in a valid date block range.
      greatestIndex = nextGreatestIndex;
    }
  }

  return true;
}

/**
 * Returns the lowest index between all the input date block ranges. Returns 0 by default if there is no minimum or input blocks.
 *
 * The input range is not expected to be sorted.
 *
 * @param input - unsorted array of date cell ranges to scan
 */
export function getLeastDateCellIndexInDateCellRanges(input: (DateCell | DateCellRange)[]): DateCellIndex {
  return getLeastAndGreatestDateCellIndexInDateCellRanges(input)?.leastIndex ?? 0;
}

/**
 * Returns the largest index between all the input date block ranges. Returns 0 by default.
 *
 * The input range is not expected to be sorted.
 *
 * @param input - unsorted array of date cell ranges to scan
 */
export function getGreatestDateCellIndexInDateCellRanges(input: (DateCell | DateCellRange)[]): DateCellIndex {
  return getLeastAndGreatestDateCellIndexInDateCellRanges(input)?.greatestIndex ?? 0;
}

/**
 * Result containing both the smallest and largest indexes found across a set of date cell ranges,
 * along with references to the items that contain those extreme indexes.
 */
export interface LeastAndGreatestDateCellIndexResult<T> {
  /** Smallest starting index found. */
  leastIndex: number;
  /** The item containing the smallest starting index. */
  leastIndexItem: T;
  /** Largest ending index found (considers `to` values). */
  greatestIndex: number;
  /** The item containing the largest ending index. */
  greatestIndexItem: T;
}

/**
 * Returns both the least and greatest indexes across all input date cell ranges, or null if the input is empty.
 *
 * The input range is not expected to be sorted.
 *
 * @param input - unsorted array of date cell ranges to scan
 */
export function getLeastAndGreatestDateCellIndexInDateCellRanges<T extends DateCellRange>(input: T[]): Maybe<LeastAndGreatestDateCellIndexResult<T>> {
  if (!input.length) {
    return null;
  }

  let leastIndex = Number.MAX_SAFE_INTEGER;
  let greatestIndex = 0;
  let leastIndexItem: T = input[0];
  let greatestIndexItem: T = input[0];

  for (let i = 0; i < input.length; i += 1) {
    const range = input[i];
    const leastRangeIndex = range.i;
    const greatestRangeIndex = (range as DateCellRange).to || range.i;

    if (leastRangeIndex < leastIndex) {
      leastIndex = leastRangeIndex;
      leastIndexItem = range;
    }

    if (greatestRangeIndex > greatestIndex) {
      greatestIndex = greatestRangeIndex;
      greatestIndexItem = range;
    }
  }

  return {
    leastIndex,
    leastIndexItem,
    greatestIndex,
    greatestIndexItem
  };
}

/**
 * Input type used for cases where a DateRange or a DateCellRange are allowed as input but used the start/end parameters in DateRange.
 */
export interface DateCellRangeOrDateRange {
  start?: Maybe<DateOrDateCellIndex>;
  end?: Maybe<DateOrDateCellIndex>;
}

/**
 * Union type allowing a Date, DateCellIndex, or DateCellRange as input.
 */
export type DateOrDateCellIndexOrDateCellRange = DateOrDateCellIndex | DateCellRange;

/**
 * Union type extending {@link DateOrDateCellIndexOrDateCellRange} to also accept a {@link DateRange}.
 */
export type DateOrDateRangeOrDateCellIndexOrDateCellRange = DateRange | DateOrDateCellIndexOrDateCellRange;

/**
 * Creates a {@link DateCellRangeWithRange} with the given start and optional end index.
 * If `to` is omitted the range covers a single cell at index `i`.
 *
 * @param i - starting cell index
 * @param to - ending cell index (inclusive); defaults to `i`
 */
export function dateCellRange(i: number, to?: number): DateCellRangeWithRange {
  return { i, to: to ?? i };
}

/**
 * Creates a single-cell {@link DateCellRangeWithRange} where both `i` and `to` equal the given index.
 *
 * @param dateCellIndex - the index for both start and end of the range
 */
export function dateCellRangeWithRangeFromIndex(dateCellIndex: DateCellIndex): DateCellRangeWithRange {
  return dateCellRange(dateCellIndex, dateCellIndex);
}

/**
 * Normalizes any {@link DateCellOrDateCellIndexOrDateCellRange} into a {@link DateCellRangeWithRange},
 * ensuring the result always has an explicit `to` value.
 *
 * @param input - index, cell, or range to normalize
 */
export function dateCellRangeWithRange(input: DateCellOrDateCellIndexOrDateCellRange): DateCellRangeWithRange {
  if (typeof input === 'number') {
    return dateCellRangeWithRangeFromIndex(input);
  } else {
    return dateCellRange(input.i, (input as DateCellRange).to);
  }
}

/**
 * Function that returns true if the input range covers the full range of the configured DateCellRange.
 */
export type DateCellRangeIncludedByRangeFunction = (range: DateCellOrDateCellIndexOrDateCellRange) => boolean;

/**
 * Creates a {@link DateCellRangeIncludedByRangeFunction} that checks whether a given range
 * fully contains the configured `inputRange`.
 *
 * @param inputRange - the range that must be fully included
 */
export function dateCellRangeIncludedByRangeFunction(inputRange: DateCellOrDateCellIndexOrDateCellRange): DateCellRangeIncludedByRangeFunction {
  const { i, to } = dateCellRangeWithRange(inputRange);
  return (input) => {
    const range = dateCellRangeWithRange(input);
    return range.i <= i && (range?.to ?? range.i) >= to;
  };
}

/**
 * Function that returns true if the input range overlaps the range of the configured DateCellRange.
 */
export type DateCellRangeOverlapsRangeFunction = (range: DateCellOrDateCellIndexOrDateCellRange) => boolean;

/**
 * Creates a {@link DateCellRangeOverlapsRangeFunction} that checks whether a given range
 * has any overlap with the configured `inputRange`.
 *
 * @param inputRange - the range to test for overlap against
 */
export function dateCellRangeOverlapsRangeFunction(inputRange: DateCellOrDateCellIndexOrDateCellRange): DateCellRangeOverlapsRangeFunction {
  const { i, to } = dateCellRangeWithRange(inputRange);
  return (input) => {
    const range = dateCellRangeWithRange(input);
    return range.i <= to && (range?.to ?? range.i) >= i;
  };
}

/**
 * Returns true if the two ranges share at least one common index.
 *
 * @param rangeA - first range to compare
 * @param rangeB - second range to compare
 */
export function dateCellRangeOverlapsRange(rangeA: DateCellOrDateCellIndexOrDateCellRange, rangeB: DateCellOrDateCellIndexOrDateCellRange): boolean {
  return dateCellRangeOverlapsRangeFunction(rangeA)(rangeB);
}

/**
 * Returns a sort comparator that orders ranges first by starting index (`i`), then by ending index (`to`).
 *
 * In many cases {@link sortAscendingIndexNumberRefFunction} may be preferential when `to` ordering is not needed.
 */
export function sortDateCellRangeAndSizeFunction<T extends DateCellRange>(): SortCompareFunction<T> {
  return (a, b) => a.i - b.i || (a.to ?? a.i) - (b.to ?? b.i);
}

/**
 * Sorts the input date ranges in-place by ascending index using {@link sortAscendingIndexNumberRefFunction}.
 *
 * @param input - array of ranges to sort (mutated in place)
 */
export function sortDateCellRanges<T extends DateCellRange>(input: T[]): T[] {
  return input.sort(sortAscendingIndexNumberRefFunction());
}

/**
 * DateCellRange that is known to have a to value.
 */
export type DateCellRangeWithRange = RequiredOnKeys<DateCellRange, 'to'>;

/**
 * Merges an array of {@link DateCell} or {@link DateCellRange} values into the smallest set of
 * contiguous {@link DateCellRangeWithRange} values. Adjacent or overlapping ranges are combined.
 *
 * The input is sorted internally before grouping.
 *
 * @param input - cells or ranges to merge into contiguous groups
 *
 * @example
 * ```ts
 * // Three adjacent cells collapse into one range
 * groupToDateCellRanges([{ i: 0 }, { i: 1 }, { i: 2 }]);
 * // => [{ i: 0, to: 2 }]
 *
 * // Non-adjacent cells produce separate ranges
 * groupToDateCellRanges([{ i: 0 }, { i: 5 }]);
 * // => [{ i: 0, to: 0 }, { i: 5, to: 5 }]
 * ```
 */
export function groupToDateCellRanges(input: (DateCell | DateCellRange)[]): DateCellRangeWithRange[] {
  if (input.length === 0) {
    return [];
  }

  // sort by index in ascending order
  const blocks = sortDateCellRanges(input);

  function newBlockFromBlocksArrayIndex(blocksArrayIndex: number): DateCellRangeWithRange {
    const { i, to } = blocks[blocksArrayIndex] as DateCellRange;
    return {
      i,
      to: to ?? i
    };
  }

  // start at the first block
  let current: DateCellRangeWithRange = newBlockFromBlocksArrayIndex(0);

  const results: DateCellRangeWithRange[] = [];

  for (let i = 1; i < blocks.length; i += 1) {
    const block = blocks[i];
    const isContinuous = block.i <= current.to + 1;

    if (isContinuous) {
      // extend the current block.
      current.to = (blocks[i] as DateCellRange).to ?? blocks[i].i;
    } else {
      // complete/create new block.
      results.push(current);
      current = newBlockFromBlocksArrayIndex(i);
    }
  }

  results.push(current);

  return results;
}

/**
 * Returns an array containing every individual index in the given date cell range (inclusive of both `i` and `to`).
 *
 * @param input - range to expand into individual indexes
 */
export function allIndexesInDateCellRange(input: DateCellRange): DateCellIndex[] {
  return input.to != null ? range((input as DateCellRange).i, input.to + 1) : [input.i];
}

/**
 * Flattens an array of indexes and/or ranges into a single array of individual {@link DateCellIndex} values.
 *
 * @param input - mix of raw indexes and ranges to flatten
 */
export function allIndexesInDateCellRangesToArray(input: (DateCellIndex | DateCellRange)[]): DateCellIndex[] {
  const result: DateCellIndex[] = [];

  input.forEach((x) => {
    if (typeof x === 'number') {
      result.push(x);
    } else {
      const allIndexes = allIndexesInDateCellRange(x);
      pushArrayItemsIntoArray(result, allIndexes);
    }
  });

  return result;
}

/**
 * Returns a deduplicated {@link Set} of all indexes within the input ranges.
 *
 * @param input - mix of raw indexes and ranges to collect
 */
export function allIndexesInDateCellRanges(input: (DateCellIndex | DateCellRange)[]): Set<DateCellIndex> {
  return new Set<DateCellIndex>(allIndexesInDateCellRangesToArray(input));
}

/**
 * Filters the input blocks, returning only those that fall entirely within the given range.
 *
 * @param blocks - cells or ranges to filter
 * @param range - bounding range that blocks must fall within
 */
export function filterDateCellsInDateCellRange<T extends DateCell | DateCellRange>(blocks: T[], range: DateCellRangeWithRange): T[] {
  const dateCellIsWithinDateCellRange = isDateCellWithinDateCellRangeFunction(range);
  return blocks.filter(dateCellIsWithinDateCellRange);
}

/**
 * Accepted input types for range-containment checks: a raw index, a {@link DateCell}, or a {@link DateCellRange}.
 */
export type IsDateCellWithinDateCellRangeInput = DateCellOrDateCellIndexOrDateCellRange;

/**
 * Function that returns true if the input range is equal or falls within the configured DateCellRange.
 */
export type IsDateCellWithinDateCellRangeFunction = (input: IsDateCellWithinDateCellRangeInput) => boolean;

/**
 * Creates an {@link IsDateCellWithinDateCellRangeFunction} that tests whether a given cell or range
 * is fully contained within `inputRange`.
 *
 * @param inputRange - the bounding range to test containment against
 */
export function isDateCellWithinDateCellRangeFunction(inputRange: IsDateCellWithinDateCellRangeInput): IsDateCellWithinDateCellRangeFunction {
  const range = dateCellRangeWithRange(inputRange);
  return (input: IsDateCellWithinDateCellRangeInput) => {
    if (typeof input === 'number') {
      input = { i: input };
    }

    if (input.i >= range.i) {
      const to = (input as DateCellRange).to ?? input.i;
      return to <= range.to;
    }

    return false;
  };
}

/**
 * Returns true if `contains` is fully within `range`.
 *
 * @param range - the outer bounding range
 * @param contains - the cell or range to test for containment
 */
export function isDateCellWithinDateCellRange(range: IsDateCellWithinDateCellRangeInput, contains: IsDateCellWithinDateCellRangeInput) {
  return isDateCellWithinDateCellRangeFunction(range)(dateCellRangeWithRange(contains));
}

/**
 * Statistical information about the blocks in a set of date cell ranges.
 */
export interface DateCellRangeBlockCountInfo {
  /**
   * Total number of individual cell indexes across all ranges.
   */
  readonly count: number;
  /**
   * Sum of all individual indexes. Used for calculating the average.
   */
  readonly total: number;
  /**
   * The average block index (total / count), or 0 if count is 0.
   */
  readonly average: number;
}

/**
 * Computes {@link DateCellRangeBlockCountInfo} (count, total, average) for the given date cell ranges.
 *
 * Internally groups overlapping ranges before counting so each index is counted only once.
 *
 * @param inputDateCellRange - one or more cells/ranges to analyze
 */
export function dateCellRangeBlocksCountInfo(inputDateCellRange: ArrayOrValue<DateCell | DateCellRange>): DateCellRangeBlockCountInfo {
  const group = groupToDateCellRanges(asArray(inputDateCellRange));

  let count = 0;
  let total = 0;

  group.forEach((x) => {
    const blocks = Math.abs(x.to - x.i) + 1; // +1 for inclusivity
    count += blocks;

    const size = sumOfIntegersBetween(x.i, x.to);
    total += size;
  });

  return {
    count,
    total,
    average: count > 0 ? total / count : 0
  };
}

/**
 * Counts the total number of individual cell indexes across the given date cell ranges.
 *
 * Shorthand for `dateCellRangeBlocksCountInfo(input).count`.
 *
 * @param inputDateCellRange - one or more cells/ranges to count
 *
 * @example
 * ```ts
 * dateCellRangeBlocksCount({ i: 0, to: 4 }); // => 5
 * dateCellRangeBlocksCount([{ i: 0, to: 2 }, { i: 10, to: 12 }]); // => 6
 * ```
 */
export function dateCellRangeBlocksCount(inputDateCellRange: ArrayOrValue<DateCell | DateCellRange>): number {
  return dateCellRangeBlocksCountInfo(inputDateCellRange).count;
}

/**
 * Checks whether or not the input range is fully included by the configured ranges.
 */
export type DateCellRangesFullyCoverDateCellRangeFunction = (range: DateCellRange) => boolean;

/**
 * Creates a {@link DateCellRangesFullyCoverDateCellRangeFunction} that checks whether any single
 * grouped range from `ranges` fully covers a given input range.
 *
 * @param ranges - the covering ranges to test against
 */
export function dateCellRangesFullyCoverDateCellRangeFunction(ranges: ArrayOrValue<DateCellRange>): DateCellRangesFullyCoverDateCellRangeFunction {
  const groupedRanges = Array.isArray(ranges) ? groupToDateCellRanges(ranges) : [dateCellRangeWithRange(ranges)];

  return (inputRange: DateCellRange) => {
    const fn = dateCellRangeIncludedByRangeFunction(inputRange);
    return groupedRanges.findIndex(fn) !== -1;
  };
}

/**
 * Input configuration for {@link getNextDateCellTimingIndex}.
 */
export interface GetNextDateCellTimingIndexInput<T extends DateCellRange> {
  /**
   * The "current" index to evaluate against (typically represents "now").
   */
  readonly currentIndex: DateCellIndex;
  /**
   * All possible ranges to classify as past, present, or future relative to `currentIndex`.
   */
  readonly ranges: ArrayOrValue<T>;
}

/**
 * Result of {@link getNextDateCellTimingIndex}, classifying ranges relative to a current index
 * and identifying the next upcoming index/range.
 */
export interface GetNextDateCellTimingIndexResult<T extends DateCellRange> {
  /**
   * The first range that contains the current index, if any.
   */
  readonly currentResult: Maybe<T>;
  /**
   * The next index after `currentIndex` that is covered by a range, or undefined if no future ranges exist.
   */
  readonly nextIndex: Maybe<DateCellIndex>;
  /**
   * The range that contains {@link nextIndex}, if available.
   */
  readonly nextResult: Maybe<T>;
  /**
   * All ranges that contain the current index (i.e., the index falls within their `i..to` span).
   */
  readonly presentResults: T[];
  /**
   * All ranges whose `to` is before the current index.
   */
  readonly pastResults: T[];
  /**
   * All ranges whose `i` is after the current index.
   */
  readonly futureResults: T[];
}

/**
 * Classifies the given ranges as past, present, or future relative to `currentIndex`, and determines
 * the next upcoming index. Useful for "what comes next" scheduling logic against date cell timings.
 *
 * If a present range continues past `currentIndex`, its next index is preferred. Otherwise the
 * nearest future range's starting index is used.
 *
 * @param input - the current index and ranges to evaluate
 *
 * @example
 * ```ts
 * const result = getNextDateCellTimingIndex({
 *   currentIndex: 5,
 *   ranges: [
 *     { i: 0, to: 3 },   // past
 *     { i: 4, to: 7 },   // present (contains 5)
 *     { i: 10, to: 12 }  // future
 *   ]
 * });
 * // result.currentResult => { i: 4, to: 7 }
 * // result.nextIndex => 6
 * // result.pastResults.length => 1
 * ```
 */
export function getNextDateCellTimingIndex<T extends DateCellRange>(input: GetNextDateCellTimingIndexInput<T>): GetNextDateCellTimingIndexResult<T> {
  const { ranges, currentIndex } = input;

  const relativeStateGroups = makeValuesGroupMap(asArray(ranges), (range) => {
    return dateRelativeStateForDateCellRangeComparedToIndex(range, currentIndex);
  });

  const pastResults = relativeStateGroups.get('past') ?? [];
  const presentResults = relativeStateGroups.get('present') ?? [];
  const futureResults = relativeStateGroups.get('future') ?? [];

  const currentResult = presentResults[0];

  let nextResult: Maybe<T>;
  let nextIndex: Maybe<number> = currentIndex + 1;

  const nextResultFromPresent = presentResults.find((x) => dateRelativeStateForDateCellRangeComparedToIndex(x, nextIndex as number) === 'present');

  if (nextResultFromPresent) {
    nextResult = nextResultFromPresent;
  } else {
    // search through the future indexes, looking for the one with the lowest index.
    const greatestAndLeastIndexResult = getLeastAndGreatestDateCellIndexInDateCellRanges(futureResults);

    if (greatestAndLeastIndexResult) {
      nextIndex = greatestAndLeastIndexResult.leastIndex;
      nextResult = greatestAndLeastIndexResult.leastIndexItem;
    } else {
      nextIndex = undefined;
    }
  }

  return {
    currentResult,
    nextIndex,
    nextResult,
    pastResults,
    presentResults,
    futureResults
  };
}

/**
 * Determines whether a range is in the past, present, or future relative to a given index.
 *
 * @param range - the date cell range to classify
 * @param nowIndex - the reference index representing "now"
 */
export function dateRelativeStateForDateCellRangeComparedToIndex(range: DateCellRange, nowIndex: DateCellIndex): DateRelativeState {
  const { i, to } = dateCellRange(range.i, range.to);
  let state: DateRelativeState;

  if (i > nowIndex) {
    state = 'future'; // if i greater, then the range is in the future.
  } else if (to < nowIndex) {
    state = 'past'; // if i is less than or equal, and to is less than i, then it is in the past
  } else {
    state = 'present';
  }

  return state;
}

/**
 * Expands a {@link DateCellRange} into an array of individual single-cell copies, one per index
 * from `i` to `to` (inclusive). Each copy retains all properties of the original block.
 *
 * @param block - the range to expand
 *
 * @example
 * ```ts
 * expandDateCellRange({ i: 2, to: 4, data: 'x' });
 * // => [{ i: 2, to: 2, data: 'x' }, { i: 3, to: 3, data: 'x' }, { i: 4, to: 4, data: 'x' }]
 * ```
 */
export function expandDateCellRange<B extends DateCellRange | DateCellRangeWithRange>(block: B): B[] {
  return range(block.i, dateCellEndIndex(block) + 1).map((i) => {
    return { ...block, i, to: i }; // copy block, set to as i
  });
}

/**
 * A DateCell that also has the potential for a unique identifier.
 */
export interface UniqueDateCell extends DateCell, UniqueModel {}

/**
 * Represents a range of UniqueDateCell values keyed by a similar identifier (or lack of identifier).
 */
export interface UniqueDateCellRange extends UniqueDateCell, DateCellRange {}

/**
 * Returns true if the input spans more than one cell (i.e., has a `to` value strictly greater than `i`).
 *
 * @param input - range or cell to check
 */
export function dateCellRangeHasRange(input: DateCellRange | UniqueDateCell): input is DateCellRangeWithRange {
  return (input as DateCellRange).to != null && ((input as DateCellRange).to as number) > input.i;
}

/**
 * Returns the effective ending index of a range: `to` if defined, otherwise `i`.
 *
 * @param input - range or cell to read
 */
export function dateCellEndIndex(input: DateCellRange | UniqueDateCell): IndexNumber {
  return (input as DateCellRange).to ?? input.i;
}

/**
 * A grouping of UniqueDateCell values, sorted by date range.
 */
export interface UniqueDateCellRangeGroup<B extends DateCellRange | UniqueDateCell> extends DateCellRange {
  /**
   * Blocks are sorted by index.
   */
  blocks: B[];
}

/**
 * Groups all input {@link DateCellRange} or {@link UniqueDateCell} values into a single
 * {@link UniqueDateCellRangeGroup}, sorting them by index. The group's `i` is always 0
 * and `to` is the maximum ending index across all blocks.
 *
 * @param input - cells or ranges to group
 */
export function groupUniqueDateCells<B extends DateCellRange | UniqueDateCell>(input: B[]): UniqueDateCellRangeGroup<B> {
  const blocks = sortDateCellRanges([...input]);

  const i = 0;
  let to: number;

  if (blocks.length === 0) {
    to = i;
  } else {
    const lastBlock = lastValue(blocks);
    to = (lastBlock as DateCellRange).to ?? lastBlock.i;
  }

  return {
    i,
    to,
    blocks
  };
}

/**
 * Determines how to "fill" a DateRange when an empty range is detected.
 * - extend: extends the previous block to fill the range.
 * - fill: creates a new value using a factory.
 * - empty: skips the space
 */
export type ExpandUniqueDateCellsFillOption = 'extend' | 'fill' | 'empty';

/**
 * Determines how overwrite block values that are completely overlapping eachother.
 * - current: keeps the "current" value
 * - next: the next/new value overwrites the previous one
 */
export type ExpandUniqueDateCellsRetainOverlapOption = 'current' | 'next';

export interface ExpandUniqueDateCellsConfig<B extends DateCellRange | UniqueDateCell> {
  /**
   * The expected start index.
   *
   * If provided, will expand the first block to start at this index, and filter out any blocks that end before this index.
   */
  startAtIndex?: number;
  /**
   * The expected end index, inclusive.
   *
   * If provided, will expand the final block to end at this index, and filter out any blocks that start past this index.
   */
  endAtIndex?: number;
  /**
   * Determines how to fill empty ranges.
   */
  fillOption: ExpandUniqueDateCellsFillOption;
  /**
   * (Optional) Determines how to handle overwrites.
   *
   * - next: will retain the latest value (next) and overwrite the current value.
   * - current: will retain the current value and ignore any future values at that index.
   *
   * Defaults to next
   */
  retainOnOverlap?: ExpandUniqueDateCellsRetainOverlapOption;
  /**
   * Used to create new items to fill empty block sets. Required when mode is set to "fill".
   */
  fillFactory?: FactoryWithRequiredInput<B, DateCellRangeWithRange>;
}

/**
 * Result of {@link ExpandUniqueDateCellsFunction}, containing the merged/expanded blocks
 * and any blocks that were fully discarded during the merge process.
 */
export interface ExpandUniqueDateCellsResult<B extends DateCellRange | UniqueDateCell> extends UniqueDateCellRangeGroup<B> {
  /**
   * Blocks that were completely removed due to overlap resolution. Some blocks may be partially retained
   * (with adjusted `i`/`to`) and appear in `blocks` instead.
   */
  discarded: B[];
}

/**
 * Expansion function used to sort/merge/replace DateCellRange values by block.
 *
 * Can optionally specify a second array/group of blocks that are treated as "next" blocks which can take priority or not depending on the retain options.
 */
export type ExpandUniqueDateCellsFunction<B extends DateCellRange | UniqueDateCell> = (input: B[] | UniqueDateCellRangeGroup<B>, newBlocks?: B[] | UniqueDateCellRangeGroup<B>) => ExpandUniqueDateCellsResult<B>;

type DateCellRangePriority = ExpandUniqueDateCellsRetainOverlapOption;

type DateCellRangePriorityPair<B extends DateCellRange | UniqueDateCell> = {
  priority: DateCellRangePriority;
  block: B;
};

/**
 * Creates an {@link ExpandUniqueDateCellsFunction} that sorts, merges, and fills date cell ranges
 * according to the provided configuration. Handles overlap resolution, gap filling, and boundary clamping.
 *
 * @param config - controls start/end bounds, fill strategy, and overlap retention behavior
 *
 * @example
 * ```ts
 * const expand = expandUniqueDateCellsFunction({
 *   fillOption: 'empty',
 *   startAtIndex: 0,
 *   endAtIndex: 10
 * });
 *
 * const result = expand([{ i: 2, to: 5 }, { i: 8, to: 10 }]);
 * // result.blocks => [{ i: 2, to: 5 }, { i: 8, to: 10 }]
 * ```
 */
export function expandUniqueDateCellsFunction<B extends DateCellRange | UniqueDateCell>(config: ExpandUniqueDateCellsConfig<B>): ExpandUniqueDateCellsFunction<B> {
  const { startAtIndex = 0, endAtIndex, fillOption: fill, fillFactory: inputFillFactory, retainOnOverlap: inputRetainOnOverlap } = config;
  const retainOnOverlap = inputRetainOnOverlap ?? 'next';
  const maxAllowedIndex: IndexNumber = endAtIndex ?? Number.MAX_SAFE_INTEGER;
  const fillFactory = inputFillFactory as FactoryWithRequiredInput<B, DateCellRange>;

  if (!fillFactory && fill === 'fill') {
    throw new Error('fillFactory is required when fillOption is "fill".');
  }

  return (input: B[] | UniqueDateCellRangeGroup<B>, newBlocks?: B[] | UniqueDateCellRangeGroup<B>) => {
    const inputGroup = Array.isArray(input) ? groupUniqueDateCells(input) : input;
    const sorted: DateCellRangePriorityPair<B>[] = inputGroup.blocks.map((block) => ({ priority: 'current', block }));

    if (newBlocks != null) {
      const inputOverwriteGroup = Array.isArray(newBlocks) ? groupUniqueDateCells(newBlocks) : newBlocks;
      pushArrayItemsIntoArray(
        sorted,
        inputOverwriteGroup.blocks.map((block) => ({ priority: 'next', block }))
      ).sort((a, b) => a.block.i - b.block.i);
    }

    const blocks: B[] = [];
    const discarded: B[] = [];

    let current: DateCellRangePriorityPair<B> = sorted[0];
    let currentNextIndex: IndexNumber;

    let next: DateCellRangePriorityPair<B> = sorted[1];
    let nextStartIndex: IndexNumber;

    let i = 0;
    let latestTo: number = startAtIndex - 1;

    function addBlockWithRange(inputBlock: B | null, i: number, inputTo: number = i) {
      // Add in any necessary gap block first
      const gapSizeBetweenBlocks = i - (latestTo + 1);

      if (gapSizeBetweenBlocks > 0) {
        // start at the startAtIndex at a minimum
        const gapStartIndex = Math.max(latestTo + 1, startAtIndex);
        addGapBlock(gapStartIndex, i - 1);
      }

      const to = Math.min(inputTo, maxAllowedIndex) || 0;

      let block: B | null = null;

      if (inputBlock != null) {
        block = {
          ...inputBlock,
          i,
          to
        };

        blocks.push(block);
      }

      latestTo = to;

      return block;
    }

    function completeBlocks() {
      // extend or fill if there is an endAtIndex value present
      if (endAtIndex != null && latestTo < endAtIndex) {
        addGapBlock(latestTo + 1, endAtIndex);
      }
    }

    function addGapBlock(i: number, inputTo: number = i) {
      const to = Math.min(inputTo, maxAllowedIndex);

      if (fill === 'fill') {
        const dateCellRange: DateCellRangeWithRange = {
          i,
          to
        };

        const block: B = fillFactory(dateCellRange);
        addBlockWithRange(block, i, to ?? i);
      } else if (fill === 'empty') {
        // do not fill with anything
      } else if (blocks.length > 0) {
        // only extend if one or more blocks have been pushed
        const blockToExtend = lastValue(blocks);
        (blockToExtend as DateCellRange).to = inputTo;
      }

      latestTo = to;
    }

    function continueToNext(use?: B, priority?: DateCellRangePriority) {
      i += 1;
      current = use != null ? ({ block: use, priority } as DateCellRangePriorityPair<B>) : sorted[i];
      next = sorted[i + 1];

      if (next) {
        nextStartIndex = next.block.i;

        // complete loop once past the max allowed index
        if (nextStartIndex > maxAllowedIndex) {
          continueLoop = false;
        } else {
          const nextEndIndex = dateCellEndIndex(next.block);

          if (nextEndIndex <= latestTo) {
            discardCurrent(); // skip until next is not less than or equal to the latest to
            continueToNext();
          }
        }
      } else {
        continueLoop = false;
      }
    }

    function discard(pair: DateCellRangePriorityPair<B>) {
      discarded.push(pair.block);
    }

    function discardCurrent() {
      discard(current);
    }

    function discardNext() {
      discard(next);
      i += 1;
      continueToNext();
    }

    let continueLoop: boolean = Boolean(next); // only loop if next is defined, otherwise we just add the final item.

    /**
     * Used to determine how to handle two neighboring objects.
     */
    function shouldRetainCurrentOverNext() {
      if (current.priority === next.priority) {
        return retainOnOverlap === 'current';
      } else {
        return current.priority === retainOnOverlap;
      }
    }

    while (continueLoop) {
      currentNextIndex = current.block.i;
      nextStartIndex = next.block.i;

      const currentEndIndex = dateCellEndIndex(current.block);
      const nextEndIndex = dateCellEndIndex(next.block);

      if (nextStartIndex < startAtIndex || currentEndIndex < startAtIndex) {
        // do nothing if the next index is still before the current start index.

        discardCurrent();
        continueToNext();
      } else if (currentNextIndex === nextStartIndex) {
        // if next has the same range as current, then look at the tie-breaker
        if (nextEndIndex === currentEndIndex) {
          // if they're both on the same index, then take the one based on the overwrite value
          if (shouldRetainCurrentOverNext()) {
            // add current
            addBlockWithRange(current.block, currentNextIndex, nextEndIndex);
            // discard and skip the "next" value
            discardNext();
          } else {
            // discard the current
            discardCurrent();
            // move on to next
            continueToNext();
          }
        } else if (nextEndIndex > currentEndIndex) {
          // handle overlap
          if (shouldRetainCurrentOverNext()) {
            // add current
            addBlockWithRange(current.block, currentNextIndex, currentEndIndex);
            // change next to start at the next range
            continueToNext({ ...next.block, i: currentEndIndex + 1, to: nextEndIndex }, next.priority);
          } else {
            //
            discardCurrent();
            continueToNext();
          }
        } else {
          // the next item ends before the current item.
          if (shouldRetainCurrentOverNext()) {
            // discard the next value.
            discard(next);
            // continue with the current value
            continueToNext(current.block, current.priority);
          } else {
            // add the next item first since it overwrites the current
            addBlockWithRange(next.block, nextStartIndex, nextEndIndex);
            // continue with the current item as next.
            continueToNext({ ...current.block, i: nextEndIndex + 1, to: currentEndIndex }, current.priority);
          }
        }
      } else {
        // Check for any overlap
        if (currentEndIndex >= nextStartIndex) {
          // handle overlap
          if (shouldRetainCurrentOverNext()) {
            // add current
            addBlockWithRange(current.block, currentNextIndex, currentEndIndex);

            if (nextEndIndex > currentEndIndex) {
              // change next to start at the next range
              continueToNext({ ...next.block, i: currentEndIndex + 1, to: nextEndIndex }, next.priority);
            } else {
              // continue normally
              continueToNext();
            }
          } else {
            // add current up to the start index of next
            addBlockWithRange(current.block, currentNextIndex, nextStartIndex - 1);

            // check if the next one is fully contained
            if (nextEndIndex < currentEndIndex) {
              // add the next
              addBlockWithRange(next.block, nextStartIndex, nextEndIndex);

              // continue with the current
              continueToNext({ ...current.block, i: nextEndIndex + 1, to: currentEndIndex }, next.priority);
            } else {
              // continue to next
              continueToNext();
            }
          }
        } else {
          // no overlap

          // add the current block
          addBlockWithRange(current.block, currentNextIndex, currentEndIndex);
          // continue to next
          continueToNext();
        }
      }
    }

    if (current != null) {
      // if current != null, then atleast one block was input/remaining.
      const lastStartIndex = current.block.i;
      const lastEndIndex = dateCellEndIndex(current.block);

      if (lastEndIndex < startAtIndex || lastEndIndex <= latestTo || lastStartIndex > maxAllowedIndex) {
        // if the block ends before the start index, then do nothing.
        discardCurrent();
      } else {
        addBlockWithRange(current.block, Math.max(startAtIndex, lastStartIndex), Math.min(lastEndIndex, maxAllowedIndex));
      }

      completeBlocks();
    } else if (fill === 'fill') {
      completeBlocks();
    }

    const result = {
      i: 0,
      blocks,
      discarded
    };

    return result;
  };
}
