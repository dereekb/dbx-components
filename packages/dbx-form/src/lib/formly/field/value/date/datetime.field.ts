import { Observable, of } from 'rxjs';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { LabeledFieldConfig, formlyField, propsForFieldConfig, DescriptionFieldConfig } from '../../field';
import { DbxDateTimeFieldProps, DbxDateTimeFieldTimeMode, DateTimePickerConfiguration } from './datetime.field.component';
import { styleWrapper } from '../../wrapper/wrapper';

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
  const { key = 'date', timeMode = DbxDateTimeFieldTimeMode.REQUIRED, valueMode, fullDayFieldName, getConfigObs, timeOnly = false } = config;

  const fieldConfig: FormlyFieldConfig<DbxDateTimeFieldProps> = formlyField({
    key,
    type: 'datetime',
    ...propsForFieldConfig(config, {
      timeMode: timeOnly ? DbxDateTimeFieldTimeMode.REQUIRED : timeMode,
      fullDayFieldName,
      getConfigObs,
      valueMode,
      timeOnly
    })
  });

  return styleWrapper(fieldConfig, {
    classGetter: 'dbx-mat-form-field-disable-underline'
  });
}
