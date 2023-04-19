import { DescriptionFieldConfig, FieldConfig, formlyField, LabeledFieldConfig, propsAndConfigForFieldConfig } from '@dereekb/dbx-form';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { DbxFormCalendarDateScheduleRangeFieldProps } from './calendar.schedule.field.component';

export interface DateScheduleRangeFieldConfig extends Omit<LabeledFieldConfig, 'key' | 'placeholder'>, DescriptionFieldConfig, Partial<FieldConfig>, DbxFormCalendarDateScheduleRangeFieldProps {}

export function dateScheduleRangeField(config: DateScheduleRangeFieldConfig = {}): FormlyFieldConfig {
  const { key = 'schedule', filter, initialSelection } = config;
  const fieldConfig: FormlyFieldConfig = {
    ...formlyField({
      key,
      type: 'date-schedule-range',
      ...propsAndConfigForFieldConfig(config, {
        label: config.label ?? 'Schedule',
        filter,
        initialSelection
      })
    })
  };

  return fieldConfig;
}
