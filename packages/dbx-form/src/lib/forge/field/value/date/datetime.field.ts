import type { MatDatepickerField, MatDatepickerProps } from '@ng-forge/dynamic-forms-material';
import type { FieldDef, BaseValueField, RowField } from '@ng-forge/dynamic-forms';
import { filterFromPOJO, type ArrayOrValue, type Maybe, type TimezoneString, type DateOrDayString } from '@dereekb/util';
import { forgeField } from '../../field';
import { forgeRow } from '../../wrapper/wrapper';
import { forgeFormFieldWrapper, type DbxForgeFormFieldWrapperFieldDef } from '../../wrapper/formfield/formfield.field';
import type { DbxForgeDateTimeFieldComponentProps } from './datetime.field.component';
import type { DbxForgeFixedDateRangeFieldComponentProps, DbxForgeFixedDateRangeValue } from './fixeddaterange.field.component';
import { type DbxDateTimePickerConfiguration, DbxDateTimeFieldTimeMode, type DbxDateTimeFieldSyncType } from '../../../../formly/field/value/date/datetime.field.component';
import { type DbxDateTimeValueMode } from '../../../../formly/field/value/date/date.value';
import { type DateTimePresetConfiguration } from '../../../../formly/field/value/date/datetime';
import { type DbxFixedDateRangeDateRangeInput, type DbxFixedDateRangePickerConfiguration, type DbxFixedDateRangeSelectionMode } from '../../../../formly/field/value/date/fixeddaterange.field.component';
import { type ObservableOrValueGetter } from '@dereekb/rxjs';
import { of, type Observable } from 'rxjs';

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

// MARK: Date Field
/**
 * Configuration for a forge date picker field.
 */
export interface DbxForgeDateFieldConfig {
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
export function forgeDateField(config: DbxForgeDateFieldConfig): MatDatepickerField {
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
export type DbxForgeDateTimeFieldDef = BaseValueField<DbxForgeDateTimeFieldComponentProps, unknown> & {
  readonly type: typeof FORGE_DATETIME_FIELD_TYPE;
};

/**
 * Configuration for a forge date-time picker field combining date and time selection.
 *
 * Full parity with the formly `DateTimeFieldConfig` — supports timezone, valueMode, timeMode,
 * pickerConfig, presets, field sync, and all other formly datetime features.
 */
export interface DbxForgeDateTimeFieldConfig {
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
export function forgeDateTimeField(config: DbxForgeDateTimeFieldConfig): DbxForgeDateTimeFieldDef {
  const { key, label, required, readonly: isReadonly, description, ...rest } = config;

  const props: DbxForgeDateTimeFieldComponentProps = filterFromPOJO({
    timeOnly: rest.timeOnly,
    timeMode: rest.timeMode,
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
    }) as DbxForgeDateTimeFieldDef
  );
}

// MARK: Date Range Field
/**
 * Configuration for a single date within a forge date range (no time mode or sync).
 *
 * Mirrors formly's `DateDateRangeFieldDateConfig`.
 */
export type DbxForgeDateRangeFieldDateConfig = Omit<DbxForgeDateTimeFieldConfig, 'dateLabel' | 'timeOnly' | 'timeMode' | 'getSyncFieldsObs'>;

/**
 * Configuration for a forge date range field with separate start and end date pickers.
 *
 * Mirrors formly's `DateDateRangeFieldConfig`. Each start/end sub-config is passed
 * through to {@link forgeDateTimeField}, so all datetime features (timezone, presets,
 * pickerConfig, etc.) are available per-field.
 */
export interface DbxForgeDateRangeFieldConfig extends Pick<DbxForgeDateTimeFieldConfig, 'timeDate' | 'timezone' | 'showTimezone' | 'presets' | 'valueMode' | 'minuteStep'> {
  readonly required?: boolean;
  readonly start?: Partial<DbxForgeDateRangeFieldDateConfig>;
  readonly end?: Partial<DbxForgeDateRangeFieldDateConfig>;
}

/**
 * Creates a pair of date pickers for selecting a date range (start and end dates)
 * arranged in a flex row. The pickers are synchronized so the start date stays before the end date.
 *
 * This is the forge equivalent of formly's `formlyDateRangeField()`.
 *
 * @param config - Date range configuration with optional start/end overrides
 * @returns A {@link RowField} containing the start and end date field pair
 *
 * @example
 * ```typescript
 * const field = forgeDateRangeField({ required: true, start: { key: 'from' }, end: { key: 'to' } });
 * ```
 */
export function forgeDateRangeField(config: DbxForgeDateRangeFieldConfig = {}): RowField {
  const { required: inputRequired, start, end, timeDate, timezone, showTimezone, presets, valueMode, minuteStep } = config;
  const required = inputRequired ?? start?.required ?? false;

  const startFieldKey = start?.key ?? 'start';
  const endFieldKey = end?.key ?? 'end';

  const startField = forgeDateTimeField({
    dateLabel: 'Start',
    timeMode: DbxDateTimeFieldTimeMode.NONE,
    getSyncFieldsObs: () => of([{ syncWith: endFieldKey, syncType: 'after' as const }]),
    presets,
    allDayLabel: '',
    timeDate,
    timezone,
    showTimezone,
    valueMode,
    minuteStep,
    ...start,
    required,
    key: startFieldKey
  });

  const endField = forgeDateTimeField({
    dateLabel: 'End',
    timeMode: DbxDateTimeFieldTimeMode.NONE,
    getSyncFieldsObs: () => of([{ syncWith: startFieldKey, syncType: 'before' as const }]),
    presets,
    allDayLabel: '',
    timeDate,
    timezone,
    showTimezone,
    valueMode,
    minuteStep,
    ...end,
    required,
    key: endFieldKey
  });

  return forgeRow({
    fields: [
      { ...(startField as unknown as FieldDef<unknown>), col: 6 },
      { ...(endField as unknown as FieldDef<unknown>), col: 6 }
    ]
  });
}

// MARK: Date-Time Range Field
/**
 * Configuration for a single time within a forge date-time range (no full-day options).
 *
 * Mirrors formly's `DateTimeRangeFieldTimeConfig`.
 */
export type DbxForgeDateTimeRangeFieldTimeConfig = Omit<DbxForgeDateRangeFieldDateConfig, 'allDayLabel' | 'fullDayFieldName' | 'fullDayInUTC'>;

/**
 * Configuration for a forge date-time range field with separate start and end time pickers.
 *
 * Mirrors formly's `DateDateTimeRangeFieldConfig`.
 */
export interface DbxForgeDateTimeRangeFieldConfig extends Pick<DbxForgeDateTimeFieldConfig, 'timeDate' | 'timezone' | 'showTimezone' | 'presets' | 'valueMode' | 'minuteStep'> {
  readonly required?: boolean;
  readonly start?: Partial<DbxForgeDateTimeRangeFieldTimeConfig>;
  readonly end?: Partial<DbxForgeDateTimeRangeFieldTimeConfig>;
}

/**
 * Creates a pair of time-only pickers for selecting a time range (start and end times)
 * arranged in a flex row.
 *
 * This is the forge equivalent of formly's `formlyDateTimeRangeField()`.
 *
 * @param inputConfig - Time range configuration with optional start/end overrides
 * @returns A {@link RowField} containing the start and end time field pair
 *
 * @example
 * ```typescript
 * const field = forgeDateTimeRangeField({ required: true });
 * ```
 */
export function forgeDateTimeRangeField(inputConfig: DbxForgeDateTimeRangeFieldConfig = {}): RowField {
  const { required = false, start: inputStart, end: inputEnd, timezone, timeDate, showTimezone, presets, valueMode, minuteStep } = inputConfig;

  function dateTimeRangeFieldConfig(config: Maybe<Partial<DbxForgeDateTimeRangeFieldTimeConfig>>): Partial<DbxForgeDateTimeFieldConfig> {
    return {
      valueMode,
      minuteStep,
      ...config,
      required,
      timeMode: DbxDateTimeFieldTimeMode.REQUIRED,
      getSyncFieldsObs: undefined,
      timeOnly: true,
      hideDateHint: true
    };
  }

  const startKey = inputStart?.key ?? 'start';
  const endKey = inputEnd?.key ?? 'end';

  const start: Partial<DbxForgeDateTimeFieldConfig> = {
    label: 'Start Time',
    ...dateTimeRangeFieldConfig(inputStart),
    key: startKey
  };

  const end: Partial<DbxForgeDateTimeFieldConfig> = {
    label: 'End Time',
    ...dateTimeRangeFieldConfig(inputEnd),
    key: endKey
  };

  return forgeDateRangeField({
    timezone,
    timeDate,
    showTimezone,
    presets,
    start,
    end
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
export type DbxForgeFixedDateRangeFieldDef = BaseValueField<DbxForgeFixedDateRangeFieldComponentProps, DbxForgeFixedDateRangeValue> & {
  readonly type: typeof FORGE_FIXEDDATERANGE_FIELD_TYPE;
};

/**
 * Configuration for a forge fixed date range field using an inline calendar-style range picker.
 *
 * Full parity with the formly `FixedDateRangeFieldConfig`.
 */
export interface DbxForgeFixedDateRangeFieldConfig {
  readonly key: string;
  readonly label?: string;
  readonly required?: boolean;
  readonly readonly?: boolean;
  readonly description?: string;

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
 * The field is wrapped in `forgeFormFieldWrapper()` which provides the Material outlined
 * container, equivalent to formly's `['style', 'form-field']` wrappers.
 *
 * @param config - Fixed date range field configuration
 * @returns A {@link DbxForgeFormFieldWrapperFieldDef} wrapping a {@link DbxForgeFixedDateRangeFieldDef}
 *
 * @example
 * ```typescript
 * const field = forgeFixedDateRangeField({
 *   key: 'dateRange',
 *   label: 'Fixed Date Range',
 *   required: true,
 *   dateRangeInput: { type: DateRangeType.WEEKS_RANGE, distance: 1 },
 *   pickerConfig: { limits: { min: 'today_start', max: addMonths(endOfMonth(new Date()), 1) } },
 *   valueMode: DbxDateTimeValueMode.DATE_STRING
 * });
 * ```
 */
export function forgeFixedDateRangeField(config: DbxForgeFixedDateRangeFieldConfig): DbxForgeFormFieldWrapperFieldDef<DbxForgeFixedDateRangeFieldDef> {
  const { key, label, required, readonly: isReadonly, description, ...rest } = config;

  const props = filterFromPOJO({
    dateRangeInput: rest.dateRangeInput,
    selectionMode: rest.selectionMode,
    valueMode: rest.valueMode,
    fullDayInUTC: rest.fullDayInUTC,
    pickerConfig: rest.pickerConfig,
    timezone: rest.timezone,
    showTimezone: rest.showTimezone,
    presets: rest.presets,
    showRangeInput: rest.showRangeInput
  }) as DbxForgeFixedDateRangeFieldComponentProps;

  // Create the inner fixeddaterange field (label/hint handled by wrapper)
  const innerField: DbxForgeFixedDateRangeFieldDef = forgeField(
    filterFromPOJO({
      key,
      type: FORGE_FIXEDDATERANGE_FIELD_TYPE,
      label: '',
      value: undefined as unknown as DbxForgeFixedDateRangeValue,
      required,
      readonly: isReadonly,
      props: Object.keys(props).length > 0 ? props : undefined
    }) as DbxForgeFixedDateRangeFieldDef
  );

  return forgeFormFieldWrapper<DbxForgeFixedDateRangeFieldDef>({
    label: label ?? '',
    hint: description,
    fields: [innerField as unknown as FieldDef<unknown>]
  });
}
