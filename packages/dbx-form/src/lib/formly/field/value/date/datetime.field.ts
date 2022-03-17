import { Observable, of } from 'rxjs';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { LabeledFieldConfig, formlyField, templateOptionsForFieldConfig, DescriptionFieldConfig } from '../../field';
import { DbxDateTimeFieldConfig, DbxDateTimeFieldTimeMode, DateTimePickerConfiguration } from './datetime.field.component';

export interface DateTimeFieldConfig extends LabeledFieldConfig, DescriptionFieldConfig, DbxDateTimeFieldConfig { }
export interface TimeFieldConfig extends Omit<DateTimeFieldConfig, 'showDate'> { }

export const TAKE_NEXT_UPCOMING_TIME_CONFIG_OBS: () => Observable<DateTimePickerConfiguration> = () => of({
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

export function dateTimeField(config: Partial<DateTimeFieldConfig> = {}): FormlyFieldConfig {
  const {
    key = 'date',
    timeMode = DbxDateTimeFieldTimeMode.REQUIRED,
    fullDayFieldName,
    getConfigObs,
    timeOnly = false
  } = config;

  const fieldConfig: FormlyFieldConfig = formlyField({
    key,
    type: 'datetime',
    dateTimeField: {
      timeMode: (timeOnly) ? DbxDateTimeFieldTimeMode.REQUIRED : timeMode,
      fullDayFieldName,
      getConfigObs,
      timeOnly,
    },
    ...templateOptionsForFieldConfig(config),
    styleWrapper: {
      style: 'dbx-datetime-parent-form-field'
    }
  });

  return fieldConfig;
}
