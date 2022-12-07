import { DEFAULT_LAT_LNG_TEXT_FIELD_PATTERN_MESSAGE, DEFAULT_LAT_LNG_TEXT_FIELD_PLACEHOLDER, DescriptionFieldConfig, FieldConfig, formlyField, LabeledFieldConfig, propsAndConfigForFieldConfig, styleWrapper, validatorsForFieldConfig } from '@dereekb/dbx-form';
import { LAT_LNG_PATTERN } from '@dereekb/util';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { DbxFormCalendarScheduleComponentFieldProps } from './calendar.schedule.field.component';

export interface CalendarScheduleFieldConfig extends Omit<LabeledFieldConfig, 'key' | 'placeholder'>, DescriptionFieldConfig, Partial<FieldConfig>, DbxFormCalendarScheduleComponentFieldProps {}

export function calendarScheduleField(config: CalendarScheduleFieldConfig = {}): FormlyFieldConfig {
  const { key = 'schedule' } = config;
  const fieldConfig: FormlyFieldConfig = {
    ...formlyField({
      key,
      type: 'calendar-schedule',
      ...propsAndConfigForFieldConfig(config, {
        label: config.label ?? 'Schedule'
      })
    })
  };

  return fieldConfig;
}
