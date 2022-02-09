import { FormlyFieldConfig } from '@ngx-formly/core';
import { FormToggleSectionConfig } from './toggle.wrapper.component';
import { AbstractFormExpandableSectionConfig } from './expandable.wrapper.delegate';
import { FormSectionConfig } from './section.wrapper.component';
import { FormSubsectionConfig } from './subsection.wrapper.component';

export const EXPANDABLE_WRAPPER_KEY = 'expandable';
export const TOGGLE_WRAPPER_KEY = 'toggle';
export const SECTION_WRAPPER_KEY = 'section';
export const SUBSECTION_WRAPPER_KEY = 'subsection';

export function addWrapperToFormlyFieldConfig<T extends object>(fieldConfig: FormlyFieldConfig, wrapperKey: string, wrapperTemplateOptionsConfig: T): FormlyFieldConfig {
  fieldConfig.templateOptions = {
    ...fieldConfig.templateOptions,
    ...wrapperTemplateOptionsConfig
  };

  return {
    wrappers: [wrapperKey],
    templateOptions: wrapperTemplateOptionsConfig,
    fieldGroup: [fieldConfig]
  };
}

export function expandableWrapper(fieldConfig: FormlyFieldConfig, expandableSection?: AbstractFormExpandableSectionConfig): FormlyFieldConfig {
  return addWrapperToFormlyFieldConfig(fieldConfig, EXPANDABLE_WRAPPER_KEY, {
    expandableSection
  });
}

export function toggleWrapper(fieldConfig: FormlyFieldConfig, expandableSection?: FormToggleSectionConfig): FormlyFieldConfig {
  return addWrapperToFormlyFieldConfig(fieldConfig, TOGGLE_WRAPPER_KEY, {
    expandableSection
  });
}

export function sectionWrapper(fieldConfig: FormlyFieldConfig, section?: FormSectionConfig): FormlyFieldConfig {
  return addWrapperToFormlyFieldConfig(fieldConfig, SECTION_WRAPPER_KEY, {
    section
  });
}

export function subsectionWrapper(fieldConfig: FormlyFieldConfig, subsection?: FormSubsectionConfig): FormlyFieldConfig {
  return addWrapperToFormlyFieldConfig(fieldConfig, SUBSECTION_WRAPPER_KEY, {
    subsection
  });
}
