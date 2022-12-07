import { DEFAULT_LAT_LNG_TEXT_FIELD_PATTERN_MESSAGE, DEFAULT_LAT_LNG_TEXT_FIELD_PLACEHOLDER, DescriptionFieldConfig, FieldConfig, formlyField, LabeledFieldConfig, propsAndConfigForFieldConfig, styleWrapper, validatorsForFieldConfig } from '@dereekb/dbx-form';
import { LAT_LNG_PATTERN } from '@dereekb/util';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { DbxFormCalendarDateScheduleRangeFieldProps } from './calendar.schedule.field.component';

export interface DateScheduleRangeFieldConfig extends Omit<LabeledFieldConfig, 'key' | 'placeholder'>, DescriptionFieldConfig, Partial<FieldConfig>, DbxFormCalendarDateScheduleRangeFieldProps {}

export function dateScheduleRangeField(config: DateScheduleRangeFieldConfig = {}): FormlyFieldConfig {
  const { key = 'schedule' } = config;
  const fieldConfig: FormlyFieldConfig = {
    ...formlyField({
      key,
      type: 'date-schedule-range',
      ...propsAndConfigForFieldConfig(config, {
        label: config.label ?? 'Schedule'
      })
    })
  };

  return fieldConfig;
}
