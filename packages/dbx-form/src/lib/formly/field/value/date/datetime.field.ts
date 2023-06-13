import { Observable, of } from 'rxjs';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { LabeledFieldConfig, formlyField, propsAndConfigForFieldConfig, DescriptionFieldConfig, MaterialFormFieldConfig } from '../../field';
import { DbxDateTimeFieldProps, DbxDateTimeFieldTimeMode, DbxDateTimePickerConfiguration } from './datetime.field.component';
import { flexLayoutWrapper, styleWrapper } from '../../wrapper/wrapper';
import { Maybe } from '@dereekb/util';
import { DbxFixedDateRangeFieldProps } from './fixeddaterange.field.component';

export interface DateTimeFieldConfig extends LabeledFieldConfig, DescriptionFieldConfig, DbxDateTimeFieldProps, MaterialFormFieldConfig {}
export type TimeFieldConfig = Omit<DateTimeFieldConfig, 'showDate'>;

export const TAKE_NEXT_UPCOMING_TIME_CONFIG_OBS: () => Observable<DbxDateTimePickerConfiguration> = () =>
  of({
    takeNextUpcomingTime: true,
    roundDownToMinute: true
  });

/**
 * Same as DateTime field but with the Date input hidden by default.
 */
export function timeOnlyField(config: Partial<TimeFieldConfig> = {}): FormlyFieldConfig {
  return dateTimeField({
    ...config,
    timeMode: DbxDateTimeFieldTimeMode.REQUIRED,
    timeOnly: true
  });
}

export function dateTimeField(config: Partial<DateTimeFieldConfig> = {}) {
  const { key = 'date', dateLabel, timeLabel, allDayLabel, atTimeLabel, timezone, showTimezone, timeMode = DbxDateTimeFieldTimeMode.REQUIRED, valueMode, fullDayInUTC, fullDayFieldName, pickerConfig, getConfigObs, getSyncFieldsObs, hideDatePicker, hideDateHint, timeOnly = false, presets, materialFormField } = config;

  const fieldConfig: FormlyFieldConfig<DbxDateTimeFieldProps> = formlyField({
    key,
    type: 'datetime',
    ...propsAndConfigForFieldConfig(config, {
      ...materialFormField,
      appearance: 'standard',
      dateLabel,
      timeLabel,
      allDayLabel,
      atTimeLabel,
      valueMode,
      timeOnly,
      presets,
      timeMode: timeOnly ? DbxDateTimeFieldTimeMode.REQUIRED : timeMode,
      timezone,
      showTimezone,
      fullDayFieldName,
      fullDayInUTC,
      hideDatePicker,
      hideDateHint,
      pickerConfig,
      getConfigObs,
      getSyncFieldsObs
    })
  });

  return styleWrapper(fieldConfig, {
    classGetter: 'dbx-mat-form-field-disable-underline dbx-mat-form-date-time-field-wrapper'
  });
}

export type DateDateRangeFieldDateConfig = Omit<DateTimeFieldConfig, 'dateLabel' | 'timeOnly' | 'timeMode' | 'getSyncFieldsObs' | 'timezone' | 'showTimezone'>;

export interface DateDateRangeFieldConfig extends Pick<DateTimeFieldConfig, 'timezone' | 'showTimezone' | 'presets'> {
  required?: boolean;
  start?: Partial<DateDateRangeFieldDateConfig>;
  end?: Partial<DateDateRangeFieldDateConfig>;
}

export function dateRangeField(config: DateDateRangeFieldConfig = {}): FormlyFieldConfig {
  const { required: inputRequired, start, end, timezone, showTimezone, presets } = config;
  const required = inputRequired ?? start?.required ?? false;

  const startFieldKey = start?.key ?? 'start';
  const endFieldKey = end?.key ?? 'end';

  const startField = dateTimeField({
    dateLabel: 'Start',
    timeMode: DbxDateTimeFieldTimeMode.NONE,
    getSyncFieldsObs: () => of([{ syncWith: endFieldKey, syncType: 'after' }]),
    presets,
    ...start,
    timezone,
    showTimezone,
    required,
    key: startFieldKey
  });

  const endField = dateTimeField({
    dateLabel: 'End',
    timeMode: DbxDateTimeFieldTimeMode.NONE,
    getSyncFieldsObs: () => of([{ syncWith: startFieldKey, syncType: 'before' }]),
    presets,
    ...end,
    timezone,
    showTimezone,
    required,
    key: endFieldKey
  });

  return {
    key: undefined,
    fieldGroup: [flexLayoutWrapper([startField, endField], { size: 1, relative: true })]
  };
}

export type DateTimeRangeFieldTimeConfig = Omit<DateDateRangeFieldDateConfig, 'allDayLabel' | 'fullDayFieldName' | 'fullDayInUTC' | 'timezone' | 'showTimezone'>;

export interface DateDateTimeRangeFieldConfig extends Pick<DateTimeFieldConfig, 'timezone' | 'showTimezone' | 'presets'> {
  required?: boolean;
  start?: Partial<DateTimeRangeFieldTimeConfig>;
  end?: Partial<DateTimeRangeFieldTimeConfig>;
}

export function dateTimeRangeField(inputConfig: DateDateTimeRangeFieldConfig = {}): FormlyFieldConfig {
  const { required = false, start: inputStart, end: inputEnd, timezone, showTimezone, presets } = inputConfig;

  function dateTimeRangeFieldConfig(config: Maybe<Partial<DateTimeRangeFieldTimeConfig>>): Partial<DateTimeFieldConfig> {
    return {
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
    showTimezone,
    presets,
    start,
    end
  };

  return dateRangeField(config);
}

// MARK: FixedDateRange
export interface FixedDateRangeFieldConfig extends LabeledFieldConfig, DescriptionFieldConfig, DbxFixedDateRangeFieldProps {}

export function fixedDateRangeField(config: Partial<FixedDateRangeFieldConfig> = {}) {
  const { key = 'dateRange', dateRangeInput, pickerConfig, timezone, selectionMode, showTimezone, valueMode, fullDayInUTC, presets, showRangeInput } = config;

  const fieldConfig: FormlyFieldConfig<DbxDateTimeFieldProps> = formlyField({
    key,
    type: 'fixeddaterange',
    ...propsAndConfigForFieldConfig(config, {
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

  return styleWrapper(fieldConfig, {
    classGetter: 'dbx-mat-form-field-disable-underline dbx-form-fixed-date-range-field-wrapper'
  });
}
