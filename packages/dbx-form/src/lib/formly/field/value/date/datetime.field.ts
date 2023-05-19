import { Observable, of } from 'rxjs';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { LabeledFieldConfig, formlyField, propsAndConfigForFieldConfig, DescriptionFieldConfig, MaterialFormFieldConfig } from '../../field';
import { DbxDateTimeFieldProps, DbxDateTimeFieldTimeMode, DateTimePickerConfiguration } from './datetime.field.component';
import { flexLayoutWrapper, styleWrapper } from '../../wrapper/wrapper';
import { Maybe } from '@dereekb/util';

export interface DateTimeFieldConfig extends LabeledFieldConfig, DescriptionFieldConfig, DbxDateTimeFieldProps, MaterialFormFieldConfig {}
export type TimeFieldConfig = Omit<DateTimeFieldConfig, 'showDate'>;

export const TAKE_NEXT_UPCOMING_TIME_CONFIG_OBS: () => Observable<DateTimePickerConfiguration> = () =>
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
  const { key = 'date', dateLabel, timeLabel, allDayLabel, atTimeLabel, timeMode = DbxDateTimeFieldTimeMode.REQUIRED, valueMode, fullDayInUTC, fullDayFieldName, getConfigObs, getSyncFieldsObs, hideDatePicker, hideDateHint, timeOnly = false, materialFormField } = config;

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
      timeMode: timeOnly ? DbxDateTimeFieldTimeMode.REQUIRED : timeMode,
      fullDayFieldName,
      fullDayInUTC,
      hideDatePicker,
      hideDateHint,
      getConfigObs,
      getSyncFieldsObs
    })
  });

  return styleWrapper(fieldConfig, {
    classGetter: 'dbx-mat-form-field-disable-underline dbx-mat-form-date-time-field-wrapper'
  });
}

export type DateDateRangeFieldDateConfig = Omit<DateTimeFieldConfig, 'dateLabel' | 'timeOnly' | 'timeMode' | 'getSyncFieldsObs'>;

export interface DateDateRangeFieldConfig {
  required?: boolean;
  start?: Partial<DateDateRangeFieldDateConfig>;
  end?: Partial<DateDateRangeFieldDateConfig>;
}

export function dateRangeField(config: DateDateRangeFieldConfig = {}): FormlyFieldConfig {
  const { required: inputRequired, start, end } = config;
  const required = inputRequired ?? start?.required ?? false;

  const startFieldKey = start?.key ?? 'start';
  const endFieldKey = end?.key ?? 'end';

  const startField = dateTimeField({
    dateLabel: 'Start',
    ...start,
    timeMode: DbxDateTimeFieldTimeMode.NONE,
    getSyncFieldsObs: () => of([{ syncWith: endFieldKey, syncType: 'after' }]),
    required,
    key: startFieldKey
  });

  const endField = dateTimeField({
    dateLabel: 'End',
    ...end,
    timeMode: DbxDateTimeFieldTimeMode.NONE,
    getSyncFieldsObs: () => of([{ syncWith: startFieldKey, syncType: 'before' }]),
    required,
    key: endFieldKey
  });

  return {
    key: undefined,
    fieldGroup: [flexLayoutWrapper([startField, endField], { size: 1, relative: true })]
  };
}

export type DateTimeRangeFieldTimeConfig = Omit<DateDateRangeFieldDateConfig, 'allDayLabel' | 'fullDayFieldName' | 'fullDayInUTC'>;

export interface DateDateTimeRangeFieldConfig {
  required?: boolean;
  start?: Partial<DateTimeRangeFieldTimeConfig>;
  end?: Partial<DateTimeRangeFieldTimeConfig>;
}

export function dateTimeRangeField(inputConfig: DateDateTimeRangeFieldConfig = {}): FormlyFieldConfig {
  const { required = false, start: inputStart, end: inputEnd } = inputConfig;

  function dateTimeRangeFieldConfig(config: Maybe<Partial<DateTimeRangeFieldTimeConfig>>): Partial<DateTimeFieldConfig> {
    return {
      ...config,
      required,
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
    start,
    end
  };

  return dateRangeField(config);
}
