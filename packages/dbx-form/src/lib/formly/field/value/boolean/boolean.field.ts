import { type FormlyFieldConfig } from '@ngx-formly/core';
import { type LabeledFieldConfig, formlyField, type DefaultValueFieldConfig, type DescriptionFieldConfig, propsAndConfigForFieldConfig, type MaterialFormFieldConfig } from '../../field';
import { AUTO_TOUCH_WRAPPER_KEY, STYLE_WRAPPER_KEY } from '../../wrapper/wrapper.key';

/**
 * Configuration for a Material toggle (slide toggle) field.
 */
export interface ToggleFieldConfig extends Omit<LabeledFieldConfig, 'placeholder' | 'autocomplete'>, DefaultValueFieldConfig<boolean>, DescriptionFieldConfig, MaterialFormFieldConfig {}

/**
 * Creates a Formly field configuration for a Material slide toggle.
 *
 * Defaults to `false` when no default value is specified. Uses auto-touch and style wrappers.
 *
 * @param config - Toggle field configuration
 * @returns A validated {@link FormlyFieldConfig} with type `'toggle'`
 *
 * @example
 * ```typescript
 * const field = toggleField({ key: 'active', label: 'Active', defaultValue: true });
 * ```
 */
export function formlyToggleField(config: ToggleFieldConfig): FormlyFieldConfig {
  const { key, defaultValue, materialFormField } = config;

  const classGetter = 'dbx-mat-form-toggle-field-wrapper';
  return formlyField({
    key,
    type: 'toggle',
    wrappers: [AUTO_TOUCH_WRAPPER_KEY, STYLE_WRAPPER_KEY, 'form-field'], // NOTE: Must specify form-field if other wrapper specified, otherwise it will not be used.
    defaultValue: defaultValue ?? false,
    ...propsAndConfigForFieldConfig(config, {
      classGetter,
      ...materialFormField
    })
  });
}

/**
 * Configuration for a Material checkbox field.
 */
export interface CheckboxFieldConfig extends LabeledFieldConfig, DefaultValueFieldConfig<boolean>, DescriptionFieldConfig, MaterialFormFieldConfig {}

/**
 * Creates a Formly field configuration for a Material checkbox.
 *
 * Defaults to `false` when no default value is specified. Uses a style wrapper.
 *
 * @param config - Checkbox field configuration
 * @returns A validated {@link FormlyFieldConfig} with type `'checkbox'`
 *
 * @example
 * ```typescript
 * const field = checkboxField({ key: 'agree', label: 'I agree to the terms' });
 * ```
 */
export function formlyCheckboxField(config: CheckboxFieldConfig): FormlyFieldConfig {
  const { key, defaultValue, materialFormField } = config;

  const classGetter = 'dbx-mat-form-checkbox-field-wrapper';
  return formlyField({
    key,
    type: 'checkbox',
    wrappers: [STYLE_WRAPPER_KEY, 'form-field'],
    defaultValue: defaultValue ?? false,
    ...propsAndConfigForFieldConfig(config, {
      classGetter,
      ...materialFormField
    })
  });
}

/*
export function acceptTermsField({ key = 'accept', label = 'Accept Terms', description = 'In order to proceed, please accept terms', required = true }
  : Partial<FieldConfigWithDescription>): FormlyFieldConfig {
  return {
    key,
    type: 'checkbox',
    props: {
      label,
      description,
      pattern: 'true',
      required
    },
    validation: {
      messages: {
        pattern: 'Please accept the terms',
      },
    },
  } as FormlyFieldConfig;
}
*/

// MARK: Deprecated Aliases
/**
 * @deprecated Use formlyToggleField instead.
 */
export const toggleField = formlyToggleField;
/**
 * @deprecated Use formlyCheckboxField instead.
 */
export const checkboxField = formlyCheckboxField;
