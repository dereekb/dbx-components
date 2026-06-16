import { type Maybe } from '@dereekb/util';
import { type DateRangeInput, type DateRange, type DateTimeMinuteConfig } from '@dereekb/date';

/**
 * Date range input configuration without the `date` property, which is set by user selection.
 */
export type DbxFixedDateRangeDateRangeInput = Omit<DateRangeInput, 'date'>;

/**
 * Picker configuration for the fixed date range field.
 */
export type DbxFixedDateRangePickerConfiguration = Omit<DateTimeMinuteConfig, 'date'>;

/**
 * Selection mode for the fixed date range picker.
 *
 * - `'single'` — Picks one date, range is computed from the date range input config.
 * - `'normal'` — Standard start/end range picking with two clicks.
 * - `'arbitrary'` — Free-form range selection within a boundary.
 * - `'arbitrary_quick'` — Like arbitrary, but immediately sets the value on first click.
 */
export type DbxFixedDateRangeSelectionMode = 'single' | 'normal' | 'arbitrary' | 'arbitrary_quick';

/**
 * Whether the user is currently picking the start or end of a range.
 */
export type DbxFixedDateRangePicking = 'start' | 'end';

/**
 * Type of the most recent date range pick action.
 */
export type FixedDateRangeScanType = 'start' | 'end' | 'startRepeat';

/**
 * Internal scan state used to track the progressive date range selection process.
 */
export interface FixedDateRangeScan {
  /**
   * Picked the start or end of the range on the last pick.
   */
  readonly lastPickType?: Maybe<FixedDateRangeScanType>;
  /**
   * The latest date passed, if applicable.
   */
  readonly lastDateRange?: Maybe<Partial<DateRange>>;
  /**
   * The generated boundary range.
   */
  readonly boundary?: DateRange;
  /**
   * New Date Range
   */
  readonly range?: DateRange;
}
