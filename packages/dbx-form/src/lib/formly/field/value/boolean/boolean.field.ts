import { type FormlyFieldConfig } from '@ngx-formly/core';
import { type LabeledFieldConfig, formlyField, type DefaultValueFieldConfig, type DescriptionFieldConfig, propsAndConfigForFieldConfig, type MaterialFormFieldConfig } from '../../field';
import { AUTO_TOUCH_WRAPPER_KEY, STYLE_WRAPPER_KEY } from '../../wrapper/wrapper.key';

export interface ToggleFieldConfig extends Omit<LabeledFieldConfig, 'placeholder' | 'autocomplete'>, DefaultValueFieldConfig<boolean>, DescriptionFieldConfig, MaterialFormFieldConfig {}

export function toggleField(config: ToggleFieldConfig): FormlyFieldConfig {
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

export interface CheckboxFieldConfig extends LabeledFieldConfig, DefaultValueFieldConfig<boolean>, DescriptionFieldConfig, MaterialFormFieldConfig {}

export function checkboxField(config: CheckboxFieldConfig): FormlyFieldConfig {
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
