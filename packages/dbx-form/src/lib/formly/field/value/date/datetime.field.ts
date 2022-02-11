import { Observable, of } from 'rxjs';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { LabeledFieldConfig, formlyField } from '../../field';
import { DbxDateTimeFieldConfig, DateTimeFieldTimeMode, DateTimeFormlyFieldConfig, DateTimePickerConfiguration } from './datetime.field.component';

export interface DateTimeFieldConfig extends LabeledFieldConfig, DbxDateTimeFieldConfig { }
export interface TimeFieldConfig extends Omit<DateTimeFieldConfig, 'showDate'> { }

export const TAKE_NEXT_UPCOMING_TIME_CONFIG_OBS: () => Observable<DateTimePickerConfiguration> = () => of({
  takeNextUpcomingTime: true,
  roundDownToMinute: true
});

/**
 * Same as DateTime field but with the Date input hidden by default.
 */
export function timeOnlyField(config: Partial<TimeFieldConfig>): DateTimeFormlyFieldConfig {
  return dateTimeField({
    ...config,
    timeMode: DateTimeFieldTimeMode.REQUIRED,
    timeOnly: true
  });
}

export function dateTimeField({
  key = 'date',
  label = '',
  placeholder = '',
  description = '',
  timeMode = DateTimeFieldTimeMode.REQUIRED,
  fullDayFieldName,
  getConfigObs,
  timeOnly = false,
  required = false
}: Partial<DateTimeFieldConfig>): DateTimeFormlyFieldConfig {
  const fieldConfig: FormlyFieldConfig = formlyField({
    key,
    type: 'datetime',
    timeMode: (timeOnly) ? DateTimeFieldTimeMode.REQUIRED : timeMode,
    fullDayFieldName,
    getConfigObs,
    timeOnly,
    templateOptions: {
      label,
      placeholder,
      required,
      description,
      styleWrapper: {
        style: 'dbx-datetime-parent-form-field'
      }
    },
  });

  // TODO: Add configuration...

  return fieldConfig;
}
