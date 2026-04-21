import type { BaseValueField } from '@ng-forge/dynamic-forms';
import { filterFromPOJO, type Maybe, type TimezoneString } from '@dereekb/util';
import { configureDbxForgeFormFieldWrapper } from '../../wrapper/formfield/formfield.wrapper';
import { dbxForgeFieldFunction, dbxForgeFieldFunctionConfigPropsWithHintBuilder, dbxForgeBuildFieldDef, type DbxForgeFieldFunctionDef, type DbxForgeFieldFunction } from '../../field';
import type { DbxForgeFixedDateRangeFieldComponentProps, DbxForgeFixedDateRangeValue } from './fixeddaterange.field.component';
import { type DbxDateTimeValueMode } from '../../../../formly/field/value/date/date.value';
import { type DateTimePresetConfiguration } from '../../../../formly/field/value/date/datetime';
import { type DbxFixedDateRangeDateRangeInput, type DbxFixedDateRangePickerConfiguration, type DbxFixedDateRangeSelectionMode } from '../../../../formly/field/value/date/fixeddaterange.field.component';
import { type ObservableOrValueGetter } from '@dereekb/rxjs';

// MARK: Fixed Date Range Field
/**
 * The custom forge field type name for the fixed date range field.
 */
export const FORGE_FIXEDDATERANGE_FIELD_TYPE = 'fixeddaterange' as const;

/**
 * Field definition type for a forge fixed date range field.
 */
export type DbxForgeFixedDateRangeFieldDef = BaseValueField<DbxForgeFixedDateRangeFieldComponentProps, DbxForgeFixedDateRangeValue> & {
  readonly type: typeof FORGE_FIXEDDATERANGE_FIELD_TYPE;
};

/**
 * Configuration for a forge fixed date range field using an inline calendar-style range picker.
 *
 * Full parity with the formly `FixedDateRangeFieldConfig`.
 */
export interface DbxForgeFixedDateRangeFieldConfig extends DbxForgeFieldFunctionDef<DbxForgeFixedDateRangeFieldDef> {
  /**
   * Date range input configuration to build the date range from a single picked date.
   * Required for 'single' mode and boundary-based selection modes.
   */
  readonly dateRangeInput?: ObservableOrValueGetter<DbxFixedDateRangeDateRangeInput>;
  /**
   * Selection mode to use when picking dates on the calendar.
   *
   * - `'single'` — Picks one date, range computed from dateRangeInput config.
   * - `'normal'` — Standard start/end range picking with two clicks.
   * - `'arbitrary'` — Free-form range selection within a boundary.
   * - `'arbitrary_quick'` — Like arbitrary, but immediately sets the value on first click.
   *
   * Defaults to `'single'`.
   */
  readonly selectionMode?: Maybe<ObservableOrValueGetter<DbxFixedDateRangeSelectionMode>>;
  /**
   * Value mode for the dates in the output DateRange.
   * Defaults to DATE.
   */
  readonly valueMode?: DbxDateTimeValueMode;
  /**
   * Whether to pass the date value as a UTC date, or a date in the current timezone.
   */
  readonly fullDayInUTC?: boolean;
  /**
   * Custom picker configuration (limits, schedule).
   */
  readonly pickerConfig?: ObservableOrValueGetter<DbxFixedDateRangePickerConfiguration>;
  /**
   * The input timezone to default to. Ignored if fullDayInUTC is true.
   */
  readonly timezone?: Maybe<ObservableOrValueGetter<Maybe<TimezoneString>>>;
  /**
   * Whether to display the timezone. Defaults to true.
   */
  readonly showTimezone?: Maybe<boolean>;
  /**
   * Custom presets.
   */
  readonly presets?: ObservableOrValueGetter<DateTimePresetConfiguration[]>;
  /**
   * Whether to show the range input text fields. Defaults to true.
   */
  readonly showRangeInput?: boolean;
}

/**
 * Creates a forge field definition for a fixed date range picker wrapped in a Material-style
 * outlined container with a notched outline and floating label.
 *
 * Uses an inline `<mat-calendar>` with a custom selection strategy, matching the formly
 * `fixedDateRangeField()` behavior. Supports multiple selection modes, timezone conversion,
 * date range input configuration, and optional text inputs.
 *
 * The field is wrapped by `configureDbxForgeFormFieldWrapper` which provides the Material outlined
 * container, equivalent to formly's `['style', 'form-field']` wrappers.
 *
 * @param config - Fixed date range field configuration
 * @returns A {@link DbxForgeFixedDateRangeFieldDef}
 *
 * @example
 * ```typescript
 * const field = dbxForgeFixedDateRangeField({
 *   key: 'dateRange',
 *   label: 'Fixed Date Range',
 *   required: true,
 *   dateRangeInput: { type: DateRangeType.WEEKS_RANGE, distance: 1 },
 *   pickerConfig: { limits: { min: 'today_start', max: addMonths(endOfMonth(new Date()), 1) } },
 *   valueMode: DbxDateTimeValueMode.DATE_STRING
 * });
 * ```
 */
export const dbxForgeFixedDateRangeField = dbxForgeFieldFunction<DbxForgeFixedDateRangeFieldConfig>({
  type: FORGE_FIXEDDATERANGE_FIELD_TYPE,
  buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder((config) =>
    filterFromPOJO({
      dateRangeInput: config.dateRangeInput,
      selectionMode: config.selectionMode,
      valueMode: config.valueMode,
      fullDayInUTC: config.fullDayInUTC,
      pickerConfig: config.pickerConfig,
      timezone: config.timezone,
      showTimezone: config.showTimezone,
      presets: config.presets,
      showRangeInput: config.showRangeInput
    })
  ),
  buildFieldDef: dbxForgeBuildFieldDef((x) => {
    x.configure(configureDbxForgeFormFieldWrapper);
  })
}) as DbxForgeFieldFunction<DbxForgeFixedDateRangeFieldConfig, DbxForgeFixedDateRangeFieldDef>;
