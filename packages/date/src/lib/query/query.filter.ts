import { Maybe, TimezoneString } from "@dereekb/util";
import { DateRangeParams } from "../date/date.range";

export interface FindEqualsDateParam {
  /**
   * Date exactly equals this.
   */
  at?: Date;
}

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
 * Filter that denotes which timezone to use when searching for full-date items.
 */
export interface DateDayTimezoneHintFilter {

  /**
   * Timezone to pull items from, relatively.
   * 
   * If not provided, then items with type Days are excluded from the result.
   */
  timezone?: Maybe<TimezoneString>;

}

export interface DateItemOccuringFilter {

  /**
   * Queries items that will be "ongoing" during this period.
   * 
   * Checks that the event has started and has not yet ended.
   */
  occuringAt?: Date;

}

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
 * Simple filter for quering against items that may start and/or end within a certain range.
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

export interface DateRangeFilter extends DateDayTimezoneHintFilter {

  /**
   * Queries items that start within the specified date range.
   * 
   * Specifically queries starts >= Date, and starts <= Date.
   */
  range: DateRangeParams;

}

export interface DateItemRangeFilter extends DateRangeFilter {

  /**
   * Whether or not to filter on only items occuring within this range.
   * 
   * Specifically queries starts >= Date, and ends <= Date.
   */
  rangeContained?: boolean;

}

export interface DateItemQueryStartsEndsWithRangeFilter extends DateItemQueryStartsEndsFilter, DateItemRangeFilter { }
