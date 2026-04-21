import type { BaseValueField } from '@ng-forge/dynamic-forms';
import { filterFromPOJO, type ArrayOrValue, type Maybe, type TimezoneString, type DateOrDayString } from '@dereekb/util';
import { dbxForgeFieldFunction, dbxForgeFieldFunctionConfigPropsWithHintBuilder, type DbxForgeFieldFunctionDef, type DbxForgeFieldFunction } from '../../field';
import type { DbxForgeDateTimeFieldComponentProps } from './datetime.field.component';
import { type DbxDateTimePickerConfiguration, type DbxDateTimeFieldTimeMode, type DbxDateTimeFieldSyncType } from '../../../../formly/field/value/date/datetime.field.component';
import { type DbxDateTimeValueMode } from '../../../../formly/field/value/date/date.value';
import { type DateTimePresetConfiguration } from '../../../../formly/field/value/date/datetime';
import { type ObservableOrValueGetter } from '@dereekb/rxjs';
import { type Observable } from 'rxjs';

// MARK: Sync Field Types
/**
 * Sync field configuration for forge datetime fields.
 *
 * Same as formly's {@link DbxDateTimeFieldSyncField} but re-exported here so forge consumers
 * don't need to import from the formly module.
 */
export interface DbxForgeDateTimeSyncField {
  /**
   * Sibling field key/path to sync with.
   */
  readonly syncWith: string;
  /**
   * How to sync against the other field.
   *
   * - `'before'`: The synced field's value acts as a minimum for this field.
   * - `'after'`: The synced field's value acts as a maximum for this field.
   */
  readonly syncType: DbxDateTimeFieldSyncType;
}

// MARK: DateTime Field
/**
 * The custom forge field type name for the date-time field.
 */
export const FORGE_DATETIME_FIELD_TYPE = 'datetime' as const;

/**
 * Field definition type for a forge date-time field.
 */
export type DbxForgeDateTimeFieldDef = BaseValueField<DbxForgeDateTimeFieldComponentProps, unknown> & {
  readonly type: typeof FORGE_DATETIME_FIELD_TYPE;
};

/**
 * Configuration for a forge date-time picker field combining date and time selection.
 *
 * Full parity with the formly `DateTimeFieldConfig` — supports timezone, valueMode, timeMode,
 * pickerConfig, presets, field sync, and all other formly datetime features.
 */
export interface DbxForgeDateTimeFieldConfig extends DbxForgeFieldFunctionDef<DbxForgeDateTimeFieldDef> {
  // --- Date/Time display modes ---
  /**
   * Whether to show only the time picker (hide the date input).
   */
  readonly timeOnly?: boolean;
  /**
   * Time mode: 'required', 'optional', or 'none'.
   * Controls whether the time input is shown, optional, or hidden.
   */
  readonly timeMode?: DbxDateTimeFieldTimeMode;
  /**
   * Value mode controlling how the date value is parsed and output.
   * Supports DATE, DAY_STRING, DATE_STRING, UNIX_TIMESTAMP, MINUTE_OF_DAY, SYSTEM_MINUTE_OF_DAY.
   */
  readonly valueMode?: DbxDateTimeValueMode;

  // --- Labels ---
  /**
   * Custom label for the date input.
   */
  readonly dateLabel?: string;
  /**
   * Custom label for the time input.
   */
  readonly timeLabel?: string;
  /**
   * Label for the "All Day" hint. Defaults to "All Day".
   */
  readonly allDayLabel?: string;
  /**
   * Label for the "At" time hint. Defaults to "At".
   */
  readonly atTimeLabel?: string;

  // --- Date constraints ---
  /**
   * Minimum selectable date.
   */
  readonly minDate?: Date | string;
  /**
   * Maximum selectable date.
   */
  readonly maxDate?: Date | string;

  // --- Timezone ---
  /**
   * The input timezone. Can be a static string or an Observable.
   */
  readonly timezone?: Maybe<ObservableOrValueGetter<Maybe<TimezoneString>>>;
  /**
   * Whether to display the timezone abbreviation. Defaults to true.
   */
  readonly showTimezone?: Maybe<boolean>;

  // --- Picker configuration ---
  /**
   * Custom picker configuration with limits and schedule constraints.
   */
  readonly pickerConfig?: ObservableOrValueGetter<DbxDateTimePickerConfiguration>;

  // --- UI toggles ---
  /**
   * Whether to hide the date hint info content.
   */
  readonly hideDateHint?: boolean;
  /**
   * Whether to hide the date/calendar picker toggle.
   */
  readonly hideDatePicker?: boolean;
  /**
   * Whether to always show the date input even when only a single date can be selected.
   * Defaults to true.
   */
  readonly alwaysShowDateInput?: boolean;
  /**
   * Whether to show the clear date/time button. Defaults to true.
   */
  readonly showClearButton?: Maybe<boolean>;

  // --- Presets ---
  /**
   * Custom time presets to show in the dropdown.
   */
  readonly presets?: ObservableOrValueGetter<DateTimePresetConfiguration[]>;

  // --- Time date reference ---
  /**
   * The date to apply the time to in time-only mode.
   * Can be a Date, ISO8601DayString, Observable, or a form control path reference.
   */
  readonly timeDate?: Maybe<ObservableOrValueGetter<Maybe<DateOrDayString>>>;

  // --- Advanced ---
  /**
   * Whether to autofill the date when a time is picked.
   */
  readonly autofillDateWhenTimeIsPicked?: boolean;
  /**
   * Other form control for enabling/disabling whether it is a full day.
   * Only used if time mode is optional.
   */
  readonly fullDayFieldName?: string;
  /**
   * Whether to pass the full-day date value as UTC.
   */
  readonly fullDayInUTC?: boolean;
  /**
   * The number of minutes to add/subtract with arrow keys.
   */
  readonly minuteStep?: Maybe<number>;
  /**
   * Debounce time in ms for preventing output when input changes rapidly.
   */
  readonly inputOutputDebounceTime?: number;

  // --- Sync fields ---
  /**
   * Used for syncing with one or more sibling date fields.
   *
   * When provided, allows this datetime field to constrain its min/max date range
   * based on the values of other date fields in the same form.
   */
  readonly getSyncFieldsObs?: () => Observable<ArrayOrValue<DbxForgeDateTimeSyncField>>;
}

/**
 * Creates a forge field definition for a combined date-time picker.
 *
 * Full parity with formly `dateTimeField()` — supports timezone, valueMode, timeMode,
 * pickerConfig, presets, and all other features.
 *
 * @param config - Date-time field configuration
 * @returns A {@link DbxForgeDateTimeFieldDef}
 *
 * @example
 * ```typescript
 * const field = dbxForgeDateTimeField({
 *   key: 'eventStart',
 *   label: 'Start',
 *   required: true,
 *   timezone: 'America/New_York',
 *   valueMode: DbxDateTimeValueMode.DATE_STRING,
 *   timeMode: DbxDateTimeFieldTimeMode.OPTIONAL
 * });
 * ```
 */
export const dbxForgeDateTimeField = dbxForgeFieldFunction<DbxForgeDateTimeFieldConfig>({
  type: FORGE_DATETIME_FIELD_TYPE,
  buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder((config) =>
    filterFromPOJO({
      timeOnly: config.timeOnly,
      timeMode: config.timeMode,
      valueMode: config.valueMode,
      dateLabel: config.dateLabel,
      timeLabel: config.timeLabel,
      allDayLabel: config.allDayLabel,
      atTimeLabel: config.atTimeLabel,
      minDate: config.minDate,
      maxDate: config.maxDate,
      timezone: config.timezone,
      showTimezone: config.showTimezone,
      pickerConfig: config.pickerConfig,
      hideDateHint: config.hideDateHint,
      hideDatePicker: config.hideDatePicker,
      alwaysShowDateInput: config.alwaysShowDateInput,
      showClearButton: config.showClearButton,
      presets: config.presets,
      timeDate: config.timeDate,
      autofillDateWhenTimeIsPicked: config.autofillDateWhenTimeIsPicked,
      fullDayFieldName: config.fullDayFieldName,
      fullDayInUTC: config.fullDayInUTC,
      minuteStep: config.minuteStep,
      inputOutputDebounceTime: config.inputOutputDebounceTime,
      getSyncFieldsObs: config.getSyncFieldsObs
    })
  )
}) as DbxForgeFieldFunction<DbxForgeDateTimeFieldConfig, DbxForgeDateTimeFieldDef>;
