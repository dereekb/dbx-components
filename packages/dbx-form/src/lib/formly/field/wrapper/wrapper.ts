import { DbxFormStyleWrapperConfig } from './style.wrapper.component';
import { DbxFlexWrapperConfig } from './flex.wrapper.component';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { DbxFormToggleWrapperConfig } from './toggle.wrapper.component';
import { DbxFormSectionConfig } from './section.wrapper.component';
import { DbxFormSubsectionConfig } from './subsection.wrapper.component';
import { DbxFormInfoConfig } from './info.wrapper.component';
import { DbxFormExpandWrapperConfig } from './expand.wrapper.component';
import { DbxFlexSize } from '@dereekb/dbx-web';
import { DbxFormWorkingWrapperConfig } from './working.wrapper.component';
import { AUTO_TOUCH_WRAPPER_KEY, EXPAND_WRAPPER_KEY, TOGGLE_WRAPPER_KEY, SECTION_WRAPPER_KEY, SUBSECTION_WRAPPER_KEY, INFO_WRAPPER_KEY, STYLE_WRAPPER_KEY, WORKING_WRAPPER_KEY } from './wrapper.key';

export type WrapperFormlyFieldConfig<P, C extends FormlyFieldConfig> = FormlyFieldConfig<P> & {
  wrappers: string[];
  props: P;
  fieldGroup: [C];
};

export function addWrapperToFormlyFieldConfig<C extends FormlyFieldConfig, P extends object>(fieldConfig: C, wrapperKey: string, wrapperProps: P): WrapperFormlyFieldConfig<P, C> {
  return {
    wrappers: [wrapperKey],
    props: wrapperProps,
    fieldGroup: [fieldConfig]
  };
}

export function autoTouchWrapper<T extends object, C extends FormlyFieldConfig>(fieldConfig: C, autoTouchWrapper: DbxFormExpandWrapperConfig<T> = {}) {
  return addWrapperToFormlyFieldConfig<C, DbxFormExpandWrapperConfig<T>>(fieldConfig, AUTO_TOUCH_WRAPPER_KEY, autoTouchWrapper);
}

export function expandWrapper<T extends object, C extends FormlyFieldConfig>(fieldConfig: C, expandWrapper: DbxFormExpandWrapperConfig<T> = {}) {
  return addWrapperToFormlyFieldConfig<C, DbxFormExpandWrapperConfig<T>>(fieldConfig, EXPAND_WRAPPER_KEY, expandWrapper);
}

export function toggleWrapper<C extends FormlyFieldConfig>(fieldConfig: C, toggleWrapper: DbxFormToggleWrapperConfig = {}) {
  return addWrapperToFormlyFieldConfig<C, DbxFormToggleWrapperConfig>(fieldConfig, TOGGLE_WRAPPER_KEY, toggleWrapper);
}

export function sectionWrapper<C extends FormlyFieldConfig>(fieldConfig: C, sectionWrapper: DbxFormSectionConfig = {}) {
  return addWrapperToFormlyFieldConfig<C, DbxFormSectionConfig>(fieldConfig, SECTION_WRAPPER_KEY, sectionWrapper);
}

export function subsectionWrapper<C extends FormlyFieldConfig>(fieldConfig: C, subsectionWrapper: DbxFormSubsectionConfig = {}) {
  return addWrapperToFormlyFieldConfig<C, DbxFormSubsectionConfig>(fieldConfig, SUBSECTION_WRAPPER_KEY, subsectionWrapper);
}

export function infoWrapper<C extends FormlyFieldConfig>(fieldConfig: C, infoWrapper: DbxFormInfoConfig) {
  return addWrapperToFormlyFieldConfig<C, DbxFormInfoConfig>(fieldConfig, INFO_WRAPPER_KEY, infoWrapper);
}

export function styleWrapper<C extends FormlyFieldConfig>(fieldConfig: C, styleWrapper: DbxFormStyleWrapperConfig) {
  return addWrapperToFormlyFieldConfig<C, DbxFormStyleWrapperConfig>(fieldConfig, STYLE_WRAPPER_KEY, styleWrapper);
}

export function workingWrapper<C extends FormlyFieldConfig>(fieldConfig: C, workingWrapper: DbxFormWorkingWrapperConfig = {}) {
  return addWrapperToFormlyFieldConfig<C, DbxFormWorkingWrapperConfig>(fieldConfig, WORKING_WRAPPER_KEY, workingWrapper);
}

export interface DbxFlexLayoutWrapperGroupFieldConfig {
  field: FormlyFieldConfig;
  /**
   * Flex space sizing for the field. If undefined it will default to the provided default size.
   */
  size?: DbxFlexSize;
}

export interface DbxFlexLayoutWrapperGroupFieldConfigDefaults extends DbxFlexWrapperConfig, Omit<DbxFlexLayoutWrapperGroupFieldConfig, 'field'> {}

export function checkIsFieldFlexLayoutGroupFieldConfig(input: FormlyFieldConfig | DbxFlexLayoutWrapperGroupFieldConfig): input is DbxFlexLayoutWrapperGroupFieldConfig {
  if ((input as DbxFlexLayoutWrapperGroupFieldConfig).field != null) {
    return true;
  } else {
    return false;
  }
}

export function flexLayoutWrapper(fieldConfigs: (FormlyFieldConfig | DbxFlexLayoutWrapperGroupFieldConfig)[], { relative, breakpoint, breakToColumn, size: defaultSize = 2 }: DbxFlexLayoutWrapperGroupFieldConfigDefaults = {}): FormlyFieldConfig<DbxFlexWrapperConfig> {
  return {
    wrappers: ['flex'],
    fieldGroupClassName: 'dbx-flex-group',
    // fieldGroupClassName: 'field-layout-group',
    props: {
      breakpoint,
      breakToColumn,
      relative
    },
    fieldGroup: fieldConfigs.map((inputConfig) => {
      const fieldConfig: DbxFlexLayoutWrapperGroupFieldConfig = checkIsFieldFlexLayoutGroupFieldConfig(inputConfig)
        ? inputConfig
        : {
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

// TODO: Add addon wrapper/extension from this demo:
// https://formly.dev/docs/examples/other/material-prefix-suffix

/*
export interface NumberFieldAddon {
  readonly text?: Maybe<string>;
  readonly icon?: Maybe<string>;
}
  
readonly addonLeft?: Maybe<NumberFieldAddon>;
readonly addonRight?: Maybe<NumberFieldAddon>;
*/
