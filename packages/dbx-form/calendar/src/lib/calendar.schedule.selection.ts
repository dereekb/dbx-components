import { DateBlockRangeWithRange, DateRange, DateScheduleRange } from '@dereekb/date';

export interface CalendarScheduleSelectionValue {
  /**
   * Schedule range.
   */
  dateScheduleRange: DateScheduleRange;
  /**
   * Min and max dates in the selection.
   */
  minMaxRange: DateRange;
}
