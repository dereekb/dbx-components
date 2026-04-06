import type { MatDatepickerField, MatDatepickerProps } from '@ng-forge/dynamic-forms-material';
import type { FieldDef, BaseValueField } from '@ng-forge/dynamic-forms';
import { filterFromPOJO, type ArrayOrValue, type Maybe, type TimezoneString, type DateOrDayString } from '@dereekb/util';
import { forgeField } from '../../field';
import type { ForgeDateTimeFieldComponentProps } from './datetime.field.component';
import type { ForgeDateRangeFieldComponentProps, ForgeDateRangeValue } from './daterange.field.component';
import type { ForgeFixedDateRangeFieldComponentProps, ForgeFixedDateRangeValue } from './fixeddaterange.field.component';
import { type DbxDateTimePickerConfiguration, DbxDateTimeFieldTimeMode, type DbxDateTimeFieldSyncType } from '../../../../formly/field/value/date/datetime.field.component';
import { type DbxDateTimeValueMode } from '../../../../formly/field/value/date/date.value';
import { type DateTimePresetConfiguration } from '../../../../formly/field/value/date/datetime';
import { type ObservableOrValueGetter } from '@dereekb/rxjs';
import type { Observable } from 'rxjs';

// MARK: Sync Field Types

/**
 * Sync field configuration for forge datetime fields.
 *
 * Same as formly's {@link DbxDateTimeFieldSyncField} but re-exported here so forge consumers
 * don't need to import from the formly module.
 */
export interface ForgeDateTimeSyncField {
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

// MARK: Date Field
/**
 * Configuration for a forge date picker field.
 */
export interface ForgeDateFieldConfig {
  readonly key: string;
  readonly label?: string;
  readonly required?: boolean;
  readonly readonly?: boolean;
  readonly description?: string;
  /**
   * Minimum selectable date.
   */
  readonly minDate?: Date | string;
  /**
   * Maximum selectable date.
   */
  readonly maxDate?: Date | string;
  /**
   * Date to start the calendar view at when opened.
   */
  readonly startAt?: Date;
}

/**
 * Creates a forge field definition for a date picker input.
 *
 * Uses the native ng-forge MatDatepickerField.
 *
 * @param config - Date field configuration including key, label, and date constraints
 * @returns A validated {@link MatDatepickerField}
 *
 * @example
 * ```typescript
 * const field = forgeDateField({ key: 'startDate', label: 'Start Date', required: true });
 * ```
 */
export function forgeDateField(config: ForgeDateFieldConfig): MatDatepickerField {
  const { key, label, required, readonly: isReadonly, description, minDate, maxDate, startAt } = config;

  const props: Partial<MatDatepickerProps> = filterFromPOJO({
    hint: description
  });

  return forgeField(
    filterFromPOJO({
      key,
      type: 'datepicker' as const,
      label: label ?? '',
      value: undefined as unknown as Date,
      required,
      readonly: isReadonly,
      minDate,
      maxDate,
      startAt,
      props: Object.keys(props).length > 0 ? props : undefined
    }) as MatDatepickerField
  );
}

// MARK: DateTime Field
/**
 * The custom forge field type name for the date-time field.
 */
export const FORGE_DATETIME_FIELD_TYPE = 'datetime' as const;

/**
 * Field definition type for a forge date-time field.
 */
export type ForgeDateTimeFieldDef = BaseValueField<ForgeDateTimeFieldComponentProps, unknown> & {
  readonly type: typeof FORGE_DATETIME_FIELD_TYPE;
};

/**
 * Configuration for a forge date-time picker field combining date and time selection.
 *
 * Full parity with the formly `DateTimeFieldConfig` — supports timezone, valueMode, timeMode,
 * pickerConfig, presets, field sync, and all other formly datetime features.
 */
export interface ForgeDateTimeFieldConfig {
  readonly key: string;
  readonly label?: string;
  readonly required?: boolean;
  readonly readonly?: boolean;
  readonly description?: string;

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
  readonly getSyncFieldsObs?: () => Observable<ArrayOrValue<ForgeDateTimeSyncField>>;

  // --- Deprecated/unsupported in forge (kept for interface parity) ---
  /**
   * Whether to include a time input alongside the date picker.
   * @deprecated Use `timeMode` instead. Kept for backward compatibility.
   */
  readonly showTime?: boolean;
}

/**
 * Creates a forge field definition for a combined date-time picker.
 *
 * Full parity with formly `dateTimeField()` — supports timezone, valueMode, timeMode,
 * pickerConfig, presets, and all other features.
 *
 * @param config - Date-time field configuration
 * @returns A {@link ForgeDateTimeFieldDef}
 *
 * @example
 * ```typescript
 * const field = forgeDateTimeField({
 *   key: 'eventStart',
 *   label: 'Start',
 *   required: true,
 *   timezone: 'America/New_York',
 *   valueMode: DbxDateTimeValueMode.DATE_STRING,
 *   timeMode: DbxDateTimeFieldTimeMode.OPTIONAL
 * });
 * ```
 */
export function forgeDateTimeField(config: ForgeDateTimeFieldConfig): ForgeDateTimeFieldDef {
  const { key, label, required, readonly: isReadonly, description, ...rest } = config;

  // Map showTime to timeMode for backward compatibility
  let effectiveTimeMode = rest.timeMode;
  if (effectiveTimeMode === undefined && rest.showTime === false) {
    effectiveTimeMode = 'none' as DbxDateTimeFieldTimeMode;
  }

  const props: ForgeDateTimeFieldComponentProps = filterFromPOJO({
    timeOnly: rest.timeOnly,
    timeMode: effectiveTimeMode,
    valueMode: rest.valueMode,
    dateLabel: rest.dateLabel,
    timeLabel: rest.timeLabel,
    allDayLabel: rest.allDayLabel,
    atTimeLabel: rest.atTimeLabel,
    minDate: rest.minDate,
    maxDate: rest.maxDate,
    timezone: rest.timezone,
    showTimezone: rest.showTimezone,
    pickerConfig: rest.pickerConfig,
    hideDateHint: rest.hideDateHint,
    hideDatePicker: rest.hideDatePicker,
    alwaysShowDateInput: rest.alwaysShowDateInput,
    showClearButton: rest.showClearButton,
    presets: rest.presets,
    timeDate: rest.timeDate,
    autofillDateWhenTimeIsPicked: rest.autofillDateWhenTimeIsPicked,
    fullDayFieldName: rest.fullDayFieldName,
    fullDayInUTC: rest.fullDayInUTC,
    minuteStep: rest.minuteStep,
    inputOutputDebounceTime: rest.inputOutputDebounceTime,
    getSyncFieldsObs: rest.getSyncFieldsObs,
    hint: description
  });

  return forgeField(
    filterFromPOJO({
      key,
      type: FORGE_DATETIME_FIELD_TYPE,
      label: label ?? '',
      value: undefined as unknown,
      required,
      readonly: isReadonly,
      props: Object.keys(props).length > 0 ? props : undefined
    }) as ForgeDateTimeFieldDef
  );
}

// MARK: Date Range Field
/**
 * The custom forge field type name for the date range field.
 */
export const FORGE_DATERANGE_FIELD_TYPE = 'daterange' as const;

/**
 * Field definition type for a forge date range field.
 */
export type ForgeDateRangeFieldDef = BaseValueField<ForgeDateRangeFieldComponentProps, ForgeDateRangeValue> & {
  readonly type: typeof FORGE_DATERANGE_FIELD_TYPE;
};

/**
 * Configuration for a forge date range field with start and end date selection.
 */
export interface ForgeDateRangeFieldConfig {
  readonly key: string;
  readonly label?: string;
  readonly required?: boolean;
  readonly readonly?: boolean;
  readonly description?: string;
  /**
   * Label for the start date input.
   */
  readonly startLabel?: string;
  /**
   * Label for the end date input.
   */
  readonly endLabel?: string;
  /**
   * Whether to include time inputs alongside the date pickers.
   */
  readonly showTime?: boolean;
  /**
   * Minimum selectable date for both start and end.
   */
  readonly minDate?: Date | string;
  /**
   * Maximum selectable date for both start and end.
   */
  readonly maxDate?: Date | string;
}

/**
 * Creates a forge field definition for a date range field.
 *
 * @param config - Date range field configuration
 * @returns A {@link ForgeDateRangeFieldDef}
 *
 * @example
 * ```typescript
 * const field = forgeDateRangeField({ key: 'eventDates', label: 'Event Dates', showTime: true });
 * ```
 */
export function forgeDateRangeField(config: ForgeDateRangeFieldConfig): ForgeDateRangeFieldDef {
  const { key, label, required, readonly: isReadonly, description, startLabel, endLabel, showTime, minDate, maxDate } = config;

  const props: ForgeDateRangeFieldComponentProps = filterFromPOJO({
    startLabel,
    endLabel,
    showTime,
    minDate,
    maxDate,
    hint: description
  });

  return forgeField(
    filterFromPOJO({
      key,
      type: FORGE_DATERANGE_FIELD_TYPE,
      label: label ?? '',
      value: undefined as unknown as ForgeDateRangeValue,
      required,
      readonly: isReadonly,
      props: Object.keys(props).length > 0 ? props : undefined
    }) as ForgeDateRangeFieldDef
  );
}

// MARK: Date-Time Range Field
/**
 * Configuration for a forge date-time range field (convenience wrapper for date range with time).
 */
export interface ForgeDateTimeRangeFieldConfig extends ForgeDateRangeFieldConfig {}

/**
 * Creates a forge field definition for a date-time range field.
 *
 * This is a convenience wrapper that creates a date range field with time inputs enabled.
 *
 * @param config - Date-time range field configuration
 * @returns A {@link ForgeDateRangeFieldDef}
 */
export function forgeDateTimeRangeField(config: ForgeDateTimeRangeFieldConfig): ForgeDateRangeFieldDef {
  return forgeDateRangeField({
    ...config,
    showTime: config.showTime ?? true
  });
}

// MARK: Fixed Date Range Field
/**
 * The custom forge field type name for the fixed date range field.
 */
export const FORGE_FIXEDDATERANGE_FIELD_TYPE = 'fixeddaterange' as const;

/**
 * Field definition type for a forge fixed date range field.
 */
export type ForgeFixedDateRangeFieldDef = BaseValueField<ForgeFixedDateRangeFieldComponentProps, ForgeFixedDateRangeValue> & {
  readonly type: typeof FORGE_FIXEDDATERANGE_FIELD_TYPE;
};

/**
 * Configuration for a forge fixed date range field using a calendar-style range picker.
 */
export interface ForgeFixedDateRangeFieldConfig {
  readonly key: string;
  readonly label?: string;
  readonly required?: boolean;
  readonly readonly?: boolean;
  readonly description?: string;
  /**
   * Label for the start date input.
   */
  readonly startLabel?: string;
  /**
   * Label for the end date input.
   */
  readonly endLabel?: string;
  /**
   * Minimum selectable date.
   */
  readonly minDate?: Date | string;
  /**
   * Maximum selectable date.
   */
  readonly maxDate?: Date | string;
}

/**
 * Creates a forge field definition for a fixed date range picker.
 *
 * Uses Angular Material's mat-date-range-input for inline start/end date picking.
 *
 * @param config - Fixed date range field configuration
 * @returns A {@link ForgeFixedDateRangeFieldDef}
 */
export function forgeFixedDateRangeField(config: ForgeFixedDateRangeFieldConfig): ForgeFixedDateRangeFieldDef {
  const { key, label, required, readonly: isReadonly, description, startLabel, endLabel, minDate, maxDate } = config;

  const props: ForgeFixedDateRangeFieldComponentProps = filterFromPOJO({
    startLabel,
    endLabel,
    minDate,
    maxDate,
    hint: description
  });

  return forgeField(
    filterFromPOJO({
      key,
      type: FORGE_FIXEDDATERANGE_FIELD_TYPE,
      label: label ?? '',
      value: undefined as unknown as ForgeFixedDateRangeValue,
      required,
      readonly: isReadonly,
      props: Object.keys(props).length > 0 ? props : undefined
    }) as ForgeFixedDateRangeFieldDef
  );
}
