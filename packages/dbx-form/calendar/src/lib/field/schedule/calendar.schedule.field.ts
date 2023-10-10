import { DescriptionFieldConfig, FieldConfig, formlyField, LabeledFieldConfig, propsAndConfigForFieldConfig } from '@dereekb/dbx-form';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { DbxFormCalendarDateCellScheduleRangeFieldProps } from './calendar.schedule.field.component';

export interface DateCellScheduleRangeFieldConfig extends Omit<LabeledFieldConfig, 'key' | 'placeholder'>, DescriptionFieldConfig, Partial<FieldConfig>, DbxFormCalendarDateCellScheduleRangeFieldProps {}

export function dateScheduleRangeField(config: DateCellScheduleRangeFieldConfig = {}): FormlyFieldConfig {
  const { key = 'schedule', appearance, hideCustomize, allowTextInput, filter, timezone, initialSelectionState, computeSelectionResultRelativeToFilter, exclusions, defaultScheduleDays, minMaxDateRange, cellContentFactory, dialogContentConfig, customDetailsConfig } = config;
  const fieldConfig: FormlyFieldConfig = {
    ...formlyField({
      key,
      type: 'date-schedule-range',
      ...propsAndConfigForFieldConfig(config, {
        label: config.label ?? 'Schedule',
        allowTextInput,
        appearance,
        hideCustomize,
        timezone,
        defaultScheduleDays,
        minMaxDateRange,
        filter,
        exclusions,
        dialogContentConfig,
        computeSelectionResultRelativeToFilter,
        initialSelectionState,
        cellContentFactory,
        customDetailsConfig
      })
    })
  };

  return fieldConfig;
}
