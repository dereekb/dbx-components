import { FormlyFieldConfig } from '@ngx-formly/core';
import { FormToggleSectionConfig } from './toggle.wrapper.component';
import { concatArraysUnique } from '@/app/common/utility';

export interface FormToggleWrapperConfig {
  fieldConfig: FormlyFieldConfig;
  toggleSection?: FormToggleSectionConfig;
}

export function addToggleWrapperToField({ fieldConfig, toggleSection = {} }: FormToggleWrapperConfig): FormlyFieldConfig {
  fieldConfig.wrappers = concatArraysUnique(fieldConfig.wrappers, ['toggle']);
  fieldConfig.templateOptions = {
    ...fieldConfig.templateOptions,
    toggleSection
  };
  return fieldConfig;
}
