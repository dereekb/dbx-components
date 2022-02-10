import { DbxFlexWrapperConfig } from './flex.wrapper.component';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { DbxFormToggleWrapperConfig } from './toggle.wrapper.component';
import { DbxFormSectionConfig } from './section.wrapper.component';
import { DbxFormSubsectionConfig } from './subsection.wrapper.component';
import { DbxFormInfoConfig } from './info.wrapper.component';
import { DbxFormExpandWrapperConfig } from './expandable.wrapper.component';
import { DbxFlexSize } from '@dereekb/dbx-web';

export const EXPANDABLE_WRAPPER_KEY = 'expandable';
export const TOGGLE_WRAPPER_KEY = 'toggle';
export const SECTION_WRAPPER_KEY = 'section';
export const SUBSECTION_WRAPPER_KEY = 'subsection';
export const INFO_WRAPPER_KEY = 'info';
export const FLEX_WRAPPER_KEY = 'flex';

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

export function expandWrapper(fieldConfig: FormlyFieldConfig, expandWrapper?: DbxFormExpandWrapperConfig): FormlyFieldConfig {
  return addWrapperToFormlyFieldConfig(fieldConfig, EXPANDABLE_WRAPPER_KEY, {
    expandWrapper
  });
}

export function toggleWrapper(fieldConfig: FormlyFieldConfig, expandWrapper?: DbxFormToggleWrapperConfig): FormlyFieldConfig {
  return addWrapperToFormlyFieldConfig(fieldConfig, TOGGLE_WRAPPER_KEY, {
    expandWrapper
  });
}

export function sectionWrapper(fieldConfig: FormlyFieldConfig, sectionWrapper?: DbxFormSectionConfig): FormlyFieldConfig {
  return addWrapperToFormlyFieldConfig(fieldConfig, SECTION_WRAPPER_KEY, {
    sectionWrapper
  });
}

export function subsectionWrapper(fieldConfig: FormlyFieldConfig, subsectionWrapper?: DbxFormSubsectionConfig): FormlyFieldConfig {
  return addWrapperToFormlyFieldConfig(fieldConfig, SUBSECTION_WRAPPER_KEY, {
    subsectionWrapper
  });
}

export function infoWrapper(fieldConfig: FormlyFieldConfig, infoWrapper?: DbxFormInfoConfig): FormlyFieldConfig {
  return addWrapperToFormlyFieldConfig(fieldConfig, INFO_WRAPPER_KEY, {
    infoWrapper
  });
}

export interface DbxFlexLayoutWrapperGroupFieldConfig {
  field: FormlyFieldConfig;
  /**
   * Flex space sizing for the field. If undefined it will default to the provided default size.
   */
  size?: DbxFlexSize;
}

export interface DbxFlexLayoutWrapperGroupFieldConfigDefaults extends DbxFlexWrapperConfig, Omit<DbxFlexLayoutWrapperGroupFieldConfig, 'field'> { }

export function checkIsFieldFlexLayoutGroupFieldConfig(input: FormlyFieldConfig | DbxFlexLayoutWrapperGroupFieldConfig): input is DbxFlexLayoutWrapperGroupFieldConfig {
  if ((input as DbxFlexLayoutWrapperGroupFieldConfig).field != null) {
    return true;
  } else {
    return false;
  }
}

export function flexLayoutWrapper(fieldConfigs: (FormlyFieldConfig | DbxFlexLayoutWrapperGroupFieldConfig)[], { relative, breakpoint, size: defaultSize = 2 }: DbxFlexLayoutWrapperGroupFieldConfigDefaults = {}): FormlyFieldConfig {
  return {
    wrappers: ['flex'],
    fieldGroupClassName: 'dbx-flex-group',
    // fieldGroupClassName: 'field-layout-group',
    templateOptions: {
      flexWrapper: {
        breakpoint,
        relative
      }
    },
    fieldGroup: fieldConfigs.map((inputConfig) => {
      const fieldConfig: DbxFlexLayoutWrapperGroupFieldConfig = checkIsFieldFlexLayoutGroupFieldConfig(inputConfig) ? inputConfig : {
        field: inputConfig
      };

      const { field, size = defaultSize } = fieldConfig;
      const className = `dbx-flex-${size}`;

      return {
        ...field,
        className
      };
    })
  };
}
