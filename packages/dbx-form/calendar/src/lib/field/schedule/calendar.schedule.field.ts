import { DescriptionFieldConfig, FieldConfig, formlyField, LabeledFieldConfig, propsAndConfigForFieldConfig } from '@dereekb/dbx-form';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { DbxFormCalendarDateScheduleRangeFieldProps } from './calendar.schedule.field.component';

export interface DateScheduleRangeFieldConfig extends Omit<LabeledFieldConfig, 'key' | 'placeholder'>, DescriptionFieldConfig, Partial<FieldConfig>, DbxFormCalendarDateScheduleRangeFieldProps {}

export function dateScheduleRangeField(config: DateScheduleRangeFieldConfig = {}): FormlyFieldConfig {
  const { key = 'schedule', appearance, hideCustomize, allowTextInput, filter, timezone, initialSelectionState, computeSelectionResultRelativeToFilter, exclusions, defaultScheduleDays, minMaxDateRange, cellContentFactory, dialogContentConfig, closeDialogConfig, customDetailsConfig } = config;
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
        closeDialogConfig,
        computeSelectionResultRelativeToFilter,
        initialSelectionState,
        cellContentFactory,
        customDetailsConfig
      })
    })
  };

  return fieldConfig;
}
