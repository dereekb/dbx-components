import { type DbxFormStyleWrapperConfig } from './style.wrapper.component';
import { type DbxFlexWrapperConfig } from './flex.wrapper.component';
import { type FormlyFieldConfig } from '@ngx-formly/core';
import { type DbxFormToggleWrapperConfig } from './toggle.wrapper.component';
import { type DbxFormSectionConfig } from './section.wrapper.component';
import { type DbxFormSubsectionConfig } from './subsection.wrapper.component';
import { type DbxFormInfoConfig } from './info.wrapper.component';
import { type DbxFormExpandWrapperConfig } from './expand.wrapper.component';
import { type DbxFlexSize } from '@dereekb/dbx-web';
import { type DbxFormWorkingWrapperConfig } from './working.wrapper.component';
import { AUTO_TOUCH_WRAPPER_KEY, EXPAND_WRAPPER_KEY, TOGGLE_WRAPPER_KEY, SECTION_WRAPPER_KEY, SUBSECTION_WRAPPER_KEY, INFO_WRAPPER_KEY, STYLE_WRAPPER_KEY, WORKING_WRAPPER_KEY } from './wrapper.key';

/**
 * A {@link FormlyFieldConfig} that wraps a child field config with a named wrapper and associated props.
 *
 * @typeParam P - Wrapper props type
 * @typeParam C - Child field config type
 */
export type WrapperFormlyFieldConfig<P, C extends FormlyFieldConfig> = FormlyFieldConfig<P> & {
  wrappers: string[];
  props: P;
  fieldGroup: [C];
};

/**
 * Wraps a Formly field config with a named wrapper and its associated props.
 *
 * @param fieldConfig - The field config to wrap
 * @param wrapperKey - The registered wrapper key
 * @param wrapperProps - Configuration props for the wrapper
 * @returns A new field config with the wrapper applied
 *
 * @example
 * ```typescript
 * const wrapped = addWrapperToFormlyFieldConfig(myField, 'section', { header: 'Details' });
 * ```
 */
export function addWrapperToFormlyFieldConfig<C extends FormlyFieldConfig, P extends object>(fieldConfig: C, wrapperKey: string, wrapperProps: P): WrapperFormlyFieldConfig<P, C> {
  return {
    wrappers: [wrapperKey],
    props: wrapperProps,
    fieldGroup: [fieldConfig]
  };
}

/**
 * Wraps a field with the auto-touch wrapper that marks the control as touched on value change.
 *
 * @param fieldConfig - The field configuration to wrap
 * @param autoTouchWrapper - Optional expand wrapper configuration
 * @returns A wrapped field configuration with auto-touch behavior
 *
 * @param fieldConfig - The field configuration to wrap
 * @param autoTouchWrapper - Optional expand wrapper configuration
 */
export function autoTouchWrapper<T extends object, C extends FormlyFieldConfig>(fieldConfig: C, autoTouchWrapper: DbxFormExpandWrapperConfig<T> = {}) {
  return addWrapperToFormlyFieldConfig<C, DbxFormExpandWrapperConfig<T>>(fieldConfig, AUTO_TOUCH_WRAPPER_KEY, autoTouchWrapper);
}

/**
 * Wraps a field with the expand wrapper that shows/hides the field based on value or user click.
 *
 * @param fieldConfig - The field configuration to wrap
 * @param expandWrapper - Optional expand wrapper configuration
 * @returns A wrapped field configuration with expand/collapse behavior
 *
 * @param fieldConfig - The field configuration to wrap
 * @param expandWrapper - Optional expand wrapper configuration
 */
export function expandWrapper<T extends object, C extends FormlyFieldConfig>(fieldConfig: C, expandWrapper: DbxFormExpandWrapperConfig<T> = {}) {
  return addWrapperToFormlyFieldConfig<C, DbxFormExpandWrapperConfig<T>>(fieldConfig, EXPAND_WRAPPER_KEY, expandWrapper);
}

/**
 * Wraps a field with the toggle wrapper that uses a slide toggle to show/hide content.
 *
 * @param fieldConfig - The field configuration to wrap
 * @param toggleWrapper - Optional toggle wrapper configuration
 * @returns A wrapped field configuration with toggle show/hide behavior
 *
 * @param fieldConfig - The field configuration to wrap
 * @param toggleWrapper - Optional toggle wrapper configuration
 */
export function toggleWrapper<C extends FormlyFieldConfig>(fieldConfig: C, toggleWrapper: DbxFormToggleWrapperConfig = {}) {
  return addWrapperToFormlyFieldConfig<C, DbxFormToggleWrapperConfig>(fieldConfig, TOGGLE_WRAPPER_KEY, toggleWrapper);
}

/**
 * Wraps a field group in a section layout with an optional header and hint.
 *
 * @param fieldConfig - The field configuration to wrap
 * @param sectionWrapper - Optional section configuration with header and hint
 * @returns A wrapped field configuration with section layout
 *
 * @param fieldConfig - The field configuration to wrap
 * @param sectionWrapper - Optional section configuration with header and hint
 */
export function sectionWrapper<C extends FormlyFieldConfig>(fieldConfig: C, sectionWrapper: DbxFormSectionConfig = {}) {
  return addWrapperToFormlyFieldConfig<C, DbxFormSectionConfig>(fieldConfig, SECTION_WRAPPER_KEY, sectionWrapper);
}

/**
 * Wraps a field group in a subsection layout with an optional header and hint.
 *
 * @param fieldConfig - The field configuration to wrap
 * @param subsectionWrapper - Optional subsection configuration with header and hint
 * @returns A wrapped field configuration with subsection layout
 *
 * @param fieldConfig - The field configuration to wrap
 * @param subsectionWrapper - Optional subsection configuration with header and hint
 */
export function subsectionWrapper<C extends FormlyFieldConfig>(fieldConfig: C, subsectionWrapper: DbxFormSubsectionConfig = {}) {
  return addWrapperToFormlyFieldConfig<C, DbxFormSubsectionConfig>(fieldConfig, SUBSECTION_WRAPPER_KEY, subsectionWrapper);
}

/**
 * Wraps a field with an info button that triggers a callback when clicked.
 *
 * @param fieldConfig - The field configuration to wrap
 * @param infoWrapper - Info wrapper configuration with callback
 * @returns A wrapped field configuration with info button
 *
 * @param fieldConfig - The field configuration to wrap
 * @param infoWrapper - Info wrapper configuration with callback
 */
export function infoWrapper<C extends FormlyFieldConfig>(fieldConfig: C, infoWrapper: DbxFormInfoConfig) {
  return addWrapperToFormlyFieldConfig<C, DbxFormInfoConfig>(fieldConfig, INFO_WRAPPER_KEY, infoWrapper);
}

/**
 * Wraps a field with dynamic CSS class and style bindings.
 *
 * @param fieldConfig - The field configuration to wrap
 * @param styleWrapper - Style wrapper configuration with CSS classes and styles
 * @returns A wrapped field configuration with dynamic styling
 *
 * @param fieldConfig - The field configuration to wrap
 * @param styleWrapper - Style wrapper configuration with CSS classes and styles
 */
export function styleWrapper<C extends FormlyFieldConfig>(fieldConfig: C, styleWrapper: DbxFormStyleWrapperConfig) {
  return addWrapperToFormlyFieldConfig<C, DbxFormStyleWrapperConfig>(fieldConfig, STYLE_WRAPPER_KEY, styleWrapper);
}

/**
 * Wraps a field with a loading indicator that shows during async validation.
 *
 * @param fieldConfig - The field configuration to wrap
 * @param workingWrapper - Optional working wrapper configuration
 * @returns A wrapped field configuration with loading indicator
 *
 * @param fieldConfig - The field configuration to wrap
 * @param workingWrapper - Optional working wrapper configuration
 */
export function workingWrapper<C extends FormlyFieldConfig>(fieldConfig: C, workingWrapper: DbxFormWorkingWrapperConfig = {}) {
  return addWrapperToFormlyFieldConfig<C, DbxFormWorkingWrapperConfig>(fieldConfig, WORKING_WRAPPER_KEY, workingWrapper);
}

/**
 * Configuration for a single field within a flex layout wrapper group,
 * pairing a field config with an optional flex size.
 */
export interface DbxFlexLayoutWrapperGroupFieldConfig {
  field: FormlyFieldConfig;
  /**
   * Flex space sizing for the field. If undefined it will default to the provided default size.
   */
  size?: DbxFlexSize;
}

/**
 * Default configuration for a flex layout group, combining flex wrapper settings
 * with a default size for fields that don't specify their own.
 */
export interface DbxFlexLayoutWrapperGroupFieldConfigDefaults extends DbxFlexWrapperConfig, Omit<DbxFlexLayoutWrapperGroupFieldConfig, 'field'> {}

/**
 * Type guard that checks if the input is a {@link DbxFlexLayoutWrapperGroupFieldConfig}
 * (has a `field` property) rather than a plain {@link FormlyFieldConfig}.
 *
 * @param input - The field config or wrapper group config to check
 * @returns True if the input has a `field` property identifying it as a wrapper group config
 *
 * @param input - The field config or wrapper group config to check
 */
export function checkIsFieldFlexLayoutGroupFieldConfig(input: FormlyFieldConfig | DbxFlexLayoutWrapperGroupFieldConfig): input is DbxFlexLayoutWrapperGroupFieldConfig {
  if ((input as DbxFlexLayoutWrapperGroupFieldConfig).field != null) {
    return true;
  } else {
    return false;
  }
}

/**
 * Creates a flex-layout-wrapped field group that arranges child fields horizontally
 * with configurable sizing, breakpoints, and responsive behavior.
 *
 * @param fieldConfigs - Array of field configs or field config pairs with size overrides
 * @param options - Flex layout defaults including breakpoint, relative sizing, and default size
 * @param options.relative - Whether sizes are relative to the container
 * @param options.breakpoint - Responsive breakpoint at which to stack fields vertically
 * @param options.breakToColumn - Whether to break to column layout at the breakpoint
 * @param options.size - Default flex size for fields without an explicit size; defaults to 2
 * @returns A {@link FormlyFieldConfig} with flex wrapper applied
 *
 * @example
 * ```typescript
 * const layout = flexLayoutWrapper([
 *   { field: textField({ key: 'first' }), size: 2 },
 *   { field: textField({ key: 'last' }), size: 2 }
 * ], { relative: true });
 * ```
 */
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
