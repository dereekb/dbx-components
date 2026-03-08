import { type Maybe, type TimezoneString } from '@dereekb/util';
import { type DateRangeParams } from '../date/date.range';

/**
 * Filter parameter that matches a date exactly equal to a given value.
 */
export interface FindEqualsDateParam {
  /**
   * Date exactly equals this.
   */
  at?: Date;
}

/**
 * Extends {@link FindEqualsDateParam} with before/after bounds for range-based matching.
 */
export interface FindDateParam extends FindEqualsDateParam {
  /**
   * Date is before or equal to this point.
   */
  before?: Date;
  /**
   * Date is after or equal to this point.
   */
  after?: Date;
}

/**
 * Provides a timezone hint so that day-level (all-day) items can be correctly
 * resolved relative to the caller's local day boundaries.
 */
export interface DateDayTimezoneHintFilter {
  /**
   * Timezone to pull items from, relatively.
   *
   * If not provided, then items with type Days are excluded from the result.
   */
  timezone?: Maybe<TimezoneString>;
}

/**
 * Filter for querying date items that are active ("occurring") at a specific instant.
 */
export interface DateItemOccuringFilter {
  /**
   * Queries items that will be "ongoing" during this period.
   *
   * Checks that the event has started and has not yet ended.
   */
  occuringAt?: Date;
}

/**
 * Filter that matches items whose start and/or end dates exactly equal the given values.
 */
export interface DateItemQueryStartsEndsEqualsFilter {
  /**
   * The start of a range.
   */
  starts?: FindEqualsDateParam;

  /**
   * The end of a range.
   */
  ends?: FindEqualsDateParam;
}

/**
 * Filter for querying items whose start and/or end dates fall within
 * independently specified before/after boundaries.
 */
export interface DateItemQueryStartsEndsFilter {
  /**
   * The start of a range.
   */
  starts?: FindDateParam;

  /**
   * The end of a range.
   */
  ends?: FindDateParam;
}

/**
 * Filter that constrains results to a single date range, optionally
 * adjusted for a specific timezone.
 */
export interface DateRangeFilter extends DateDayTimezoneHintFilter {
  /**
   * Queries items that start within the specified date range.
   *
   * Specifically queries starts >= Date, and starts <= Date.
   */
  range: DateRangeParams;
}

/**
 * Extends {@link DateRangeFilter} with an option to require items to be fully
 * contained within the range rather than merely overlapping it.
 */
export interface DateItemRangeFilter extends DateRangeFilter {
  /**
   * Whether or not to filter on only items occuring within this range.
   *
   * Specifically queries starts >= Date, and ends <= Date.
   */
  rangeContained?: boolean;
}

/**
 * Composite filter combining explicit starts/ends boundaries with a
 * range-based filter, enabling both range containment and fine-grained
 * boundary constraints in a single query.
 */
export interface DateItemQueryStartsEndsWithRangeFilter extends DateItemQueryStartsEndsFilter, DateItemRangeFilter {}
