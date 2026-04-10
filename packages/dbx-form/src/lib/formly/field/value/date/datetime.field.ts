import { type Observable, of } from 'rxjs';
import { type FormlyFieldConfig } from '@ngx-formly/core';
import { type LabeledFieldConfig, formlyField, propsAndConfigForFieldConfig, type DescriptionFieldConfig, type MaterialFormFieldConfig } from '../../field';
import { type DbxDateTimeFieldProps, DbxDateTimeFieldTimeMode, type DbxDateTimePickerConfiguration } from './datetime.field.component';
import { flexLayoutWrapper } from '../../wrapper/wrapper';
import { type Maybe } from '@dereekb/util';
import { type DbxFixedDateRangeFieldProps } from './fixeddaterange.field.component';

/**
 * Full configuration for a date-time picker field combining date and time selection.
 */
export interface DateTimeFieldConfig extends LabeledFieldConfig, DescriptionFieldConfig, DbxDateTimeFieldProps, MaterialFormFieldConfig {}

/**
 * Configuration for a time-only field (date selection is hidden).
 */
export type TimeFieldConfig = Omit<DateTimeFieldConfig, 'showDate' | 'timeOnly'>;

/**
 * Factory that returns an observable of a date-time picker configuration
 * that automatically selects the next upcoming time, rounded down to the nearest minute.
 *
 * @returns An observable emitting a picker configuration with takeNextUpcomingTime and roundDownToMinute enabled
 */
export const TAKE_NEXT_UPCOMING_TIME_CONFIG_OBS: () => Observable<DbxDateTimePickerConfiguration> = () =>
  of({
    takeNextUpcomingTime: true,
    roundDownToMinute: true
  });

/**
 * Same as DateTime field but with the Date input hidden by default.
 *
 * @param config - Optional time field configuration overrides
 * @returns A {@link FormlyFieldConfig} configured as a time-only input
 *
 * @param config - Optional time field configuration overrides
 */
export function formlyTimeOnlyField(config: Partial<TimeFieldConfig> = {}): FormlyFieldConfig {
  return formlyDateTimeField({
    ...config,
    timeMode: DbxDateTimeFieldTimeMode.REQUIRED,
    timeOnly: true
  });
}

/**
 * Creates a Formly field configuration for a date-time picker with optional time selection,
 * timezone awareness, and preset values.
 *
 * @param config - Optional overrides; defaults to key `'date'`, time mode `REQUIRED`
 * @returns A validated {@link FormlyFieldConfig} with type `'datetime'`
 *
 * @example
 * ```typescript
 * const field = dateTimeField({ key: 'startDate', label: 'Start', required: true });
 * ```
 */
export function formlyDateTimeField(config: Partial<DateTimeFieldConfig> = {}) {
  const { key = 'date', showClearButton, dateLabel, timeLabel, allDayLabel, atTimeLabel, timeDate, timezone, minuteStep, showTimezone, timeMode = DbxDateTimeFieldTimeMode.REQUIRED, valueMode, alwaysShowDateInput, autofillDateWhenTimeIsPicked, fullDayInUTC, fullDayFieldName, pickerConfig, getSyncFieldsObs, hideDatePicker, hideDateHint, timeOnly = false, presets, materialFormField } = config;

  const classGetter = 'dbx-mat-form-field-disable-underline dbx-mat-form-date-time-field-wrapper';
  const fieldConfig: FormlyFieldConfig<DbxDateTimeFieldProps> = formlyField({
    key,
    type: 'datetime',
    ...propsAndConfigForFieldConfig(config, {
      ...materialFormField,
      showClearButton,
      classGetter,
      dateLabel,
      timeLabel,
      allDayLabel,
      atTimeLabel,
      valueMode,
      timeOnly,
      presets,
      minuteStep,
      timeMode: timeOnly ? DbxDateTimeFieldTimeMode.REQUIRED : timeMode,
      alwaysShowDateInput,
      autofillDateWhenTimeIsPicked,
      timezone,
      timeDate,
      showTimezone,
      fullDayFieldName,
      fullDayInUTC,
      hideDatePicker,
      hideDateHint,
      pickerConfig,
      getSyncFieldsObs
    })
  });

  return fieldConfig;
}

/**
 * Configuration for a single date within a date range (no time mode or sync).
 */
export type DateDateRangeFieldDateConfig = Omit<DateTimeFieldConfig, 'dateLabel' | 'timeOnly' | 'timeMode' | 'getSyncFieldsObs'>;

/**
 * Configuration for a date range field with separate start and end date pickers.
 */
export interface DateDateRangeFieldConfig extends Pick<DateTimeFieldConfig, 'timeDate' | 'timezone' | 'showTimezone' | 'presets' | 'valueMode' | 'minuteStep'> {
  required?: boolean;
  start?: Partial<DateDateRangeFieldDateConfig>;
  end?: Partial<DateDateRangeFieldDateConfig>;
}

/**
 * Creates a pair of date pickers for selecting a date range (start and end dates)
 * arranged in a flex layout. The pickers are synchronized so the start date stays before the end date.
 *
 * @param config - Date range configuration with optional start/end overrides
 * @returns A {@link FormlyFieldConfig} containing the start and end date field pair
 *
 * @example
 * ```typescript
 * const field = dateRangeField({ required: true, start: { key: 'from' }, end: { key: 'to' } });
 * ```
 */
export function formlyDateRangeField(config: DateDateRangeFieldConfig = {}): FormlyFieldConfig {
  const { required: inputRequired, start, end, timeDate, timezone, showTimezone, presets, valueMode, minuteStep } = config;
  const required = inputRequired ?? start?.required ?? false;

  const startFieldKey = start?.key ?? 'start';
  const endFieldKey = end?.key ?? 'end';

  const startField = formlyDateTimeField({
    dateLabel: 'Start',
    timeMode: DbxDateTimeFieldTimeMode.NONE,
    getSyncFieldsObs: () => of([{ syncWith: endFieldKey, syncType: 'after' }]),
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

  const endField = formlyDateTimeField({
    dateLabel: 'End',
    timeMode: DbxDateTimeFieldTimeMode.NONE,
    getSyncFieldsObs: () => of([{ syncWith: startFieldKey, syncType: 'before' }]),
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

  return {
    key: undefined,
    fieldGroup: [flexLayoutWrapper([startField, endField], { relative: true, breakToColumn: true, breakpoint: 'large' })]
  };
}

/**
 * Configuration for a single time within a date-time range (no full-day options).
 */
export type DateTimeRangeFieldTimeConfig = Omit<DateDateRangeFieldDateConfig, 'allDayLabel' | 'fullDayFieldName' | 'fullDayInUTC'>;

/**
 * Configuration for a date-time range field with separate start and end time pickers.
 */
export interface DateDateTimeRangeFieldConfig extends Pick<DateTimeFieldConfig, 'timeDate' | 'timezone' | 'showTimezone' | 'presets' | 'valueMode' | 'minuteStep'> {
  required?: boolean;
  start?: Partial<DateTimeRangeFieldTimeConfig>;
  end?: Partial<DateTimeRangeFieldTimeConfig>;
}

/**
 * Creates a pair of time-only pickers for selecting a time range (start and end times)
 * arranged in a flex layout.
 *
 * @param inputConfig - Time range configuration with optional start/end overrides
 * @returns A {@link FormlyFieldConfig} containing the start and end time field pair
 *
 * @example
 * ```typescript
 * const field = dateTimeRangeField({ required: true });
 * ```
 */
export function formlyDateTimeRangeField(inputConfig: DateDateTimeRangeFieldConfig = {}): FormlyFieldConfig {
  const { required = false, start: inputStart, end: inputEnd, timezone, timeDate, showTimezone, presets, valueMode, minuteStep } = inputConfig;

  function dateTimeRangeFieldConfig(config: Maybe<Partial<DateTimeRangeFieldTimeConfig>>): Partial<DateTimeFieldConfig> {
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

  const start: Partial<DateTimeFieldConfig> = {
    label: 'Start Time',
    ...dateTimeRangeFieldConfig(inputStart),
    key: startKey
  };

  const end: Partial<DateTimeFieldConfig> = {
    label: 'End Time',
    ...dateTimeRangeFieldConfig(inputEnd),
    key: endKey
  };

  const config = {
    timezone,
    timeDate,
    showTimezone,
    presets,
    start,
    end
  };

  return formlyDateRangeField(config);
}

// MARK: FixedDateRange
/**
 * Configuration for a fixed date range field that uses a calendar-style range picker.
 */
export interface FixedDateRangeFieldConfig extends LabeledFieldConfig, DescriptionFieldConfig, DbxFixedDateRangeFieldProps, MaterialFormFieldConfig {}

/**
 * Creates a Formly field configuration for a fixed date range picker.
 *
 * @param config - Optional overrides; defaults to key `'dateRange'`
 * @returns A validated {@link FormlyFieldConfig} with type `'fixeddaterange'`
 *
 * @example
 * ```typescript
 * const field = fixedDateRangeField({ key: 'eventDates', required: true });
 * ```
 */
export function formlyFixedDateRangeField(config: Partial<FixedDateRangeFieldConfig> = {}) {
  const { key = 'dateRange', dateRangeInput, pickerConfig, timezone, selectionMode, showTimezone, valueMode, fullDayInUTC, presets, showRangeInput, materialFormField } = config;

  const classGetter = 'dbx-mat-form-field-disable-underline dbx-form-fixed-date-range-field-wrapper';
  const fieldConfig: FormlyFieldConfig<DbxDateTimeFieldProps> = formlyField({
    key,
    type: 'fixeddaterange',
    ...propsAndConfigForFieldConfig(config, {
      ...materialFormField,
      classGetter,
      dateRangeInput,
      pickerConfig,
      valueMode,
      presets,
      timezone,
      selectionMode,
      showTimezone,
      fullDayInUTC,
      showRangeInput
    })
  });

  return fieldConfig;
}

// MARK: Deprecated Aliases
/**
 * @deprecated Use formlyTimeOnlyField instead.
 */
export const timeOnlyField = formlyTimeOnlyField;
/**
 * @deprecated Use formlyDateTimeField instead.
 */
export const dateTimeField = formlyDateTimeField;
/**
 * @deprecated Use formlyDateRangeField instead.
 */
export const dateRangeField = formlyDateRangeField;
/**
 * @deprecated Use formlyDateTimeRangeField instead.
 */
export const dateTimeRangeField = formlyDateTimeRangeField;
/**
 * @deprecated Use formlyFixedDateRangeField instead.
 */
export const fixedDateRangeField = formlyFixedDateRangeField;
