import { Observable, of } from 'rxjs';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { LabeledFieldConfig, formlyField, propsAndConfigForFieldConfig, DescriptionFieldConfig } from '../../field';
import { DbxDateTimeFieldProps, DbxDateTimeFieldTimeMode, DateTimePickerConfiguration, DbxDateTimeValueMode } from './datetime.field.component';
import { flexLayoutWrapper, styleWrapper } from '../../wrapper/wrapper';

export interface DateTimeFieldConfig extends LabeledFieldConfig, DescriptionFieldConfig, DbxDateTimeFieldProps {}
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
  const { key = 'date', dateLabel, timeLabel, timeMode = DbxDateTimeFieldTimeMode.REQUIRED, valueMode, fullDayInUTC, fullDayFieldName, getConfigObs, hideDateHint, timeOnly = false } = config;

  const fieldConfig: FormlyFieldConfig<DbxDateTimeFieldProps> = formlyField({
    key,
    type: 'datetime',
    ...propsAndConfigForFieldConfig(config, {
      dateLabel,
      timeLabel,
      valueMode,
      timeOnly,
      timeMode: timeOnly ? DbxDateTimeFieldTimeMode.REQUIRED : timeMode,
      fullDayFieldName,
      fullDayInUTC,
      hideDateHint,
      getConfigObs
    })
  });

  return styleWrapper(fieldConfig, {
    classGetter: 'dbx-mat-form-field-disable-underline'
  });
}

export interface DateDateRangeFieldConfig {
  start?: Partial<DateTimeFieldConfig>;
  end?: Partial<DateTimeFieldConfig>;
}

export function dateRangeField(config: DateDateRangeFieldConfig = {}): FormlyFieldConfig {
  const { start, end } = config;

  const startField = dateTimeField({
    dateLabel: 'Start',
    timeMode: DbxDateTimeFieldTimeMode.NONE,
    key: 'start',
    ...start
  });

  const endField = dateTimeField({
    dateLabel: 'End',
    timeMode: DbxDateTimeFieldTimeMode.NONE,
    key: 'end',
    ...end
  });

  return {
    key: undefined,
    fieldGroup: [flexLayoutWrapper([startField, endField], { size: 1, relative: true })]
  };
}
