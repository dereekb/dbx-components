import { type DescriptionFieldConfig, type FieldConfig, formlyField, type LabeledFieldConfig, propsAndConfigForFieldConfig } from '@dereekb/dbx-form';
import { type FormlyFieldConfig } from '@ngx-formly/core';
import { type DbxFormCalendarDateCellScheduleRangeFieldProps } from './calendar.schedule.field.component';

export interface DateScheduleRangeFieldConfig extends Omit<LabeledFieldConfig, 'key' | 'placeholder'>, DescriptionFieldConfig, Partial<FieldConfig>, DbxFormCalendarDateCellScheduleRangeFieldProps {}

export function dateScheduleRangeField(config: DateScheduleRangeFieldConfig = {}): FormlyFieldConfig {
  const { key = 'schedule', appearance, hideCustomize, allowTextInput, filter, outputTimezone, initialSelectionState, computeSelectionResultRelativeToFilter, exclusions, defaultScheduleDays, minMaxDateRange, cellContentFactory, dialogContentConfig, customDetailsConfig } = config;

  const fieldConfig: FormlyFieldConfig = {
    ...formlyField({
      key,
      type: 'date-schedule-range',
      ...propsAndConfigForFieldConfig(config, {
        label: config.label ?? 'Schedule',
        allowTextInput,
        appearance,
        hideCustomize,
        outputTimezone,
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
