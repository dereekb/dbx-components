import { FormlyFieldConfig } from '@ngx-formly/core';
import { LabeledFieldConfig, formlyField, DefaultValueFieldConfig, DescriptionFieldConfig, templateOptionsForFieldConfig } from '../../field';

export interface ToggleFieldConfig extends Omit<LabeledFieldConfig, 'placeholder' | 'autocomplete'>, DefaultValueFieldConfig<boolean>, DescriptionFieldConfig {}

export function toggleField(config: ToggleFieldConfig): FormlyFieldConfig {
  const { key, defaultValue } = config;

  return formlyField({
    key,
    type: 'toggle',
    wrappers: ['autotouch', 'form-field'], // NOTE: Must specify form-field if other wrapper specified, otherwise it will not be used.
    defaultValue: defaultValue ?? false,
    ...templateOptionsForFieldConfig(config)
  });
}

export interface CheckboxFieldConfig extends LabeledFieldConfig, DefaultValueFieldConfig<boolean>, DescriptionFieldConfig {}

export function checkboxField(config: CheckboxFieldConfig): FormlyFieldConfig {
  const { key, defaultValue } = config;

  return formlyField({
    key,
    type: 'checkbox',
    defaultValue: defaultValue ?? false,
    ...templateOptionsForFieldConfig(config)
  });
}

/*
export function acceptTermsField({ key = 'accept', label = 'Accept Terms', description = 'In order to proceed, please accept terms', required = true }
  : Partial<FieldConfigWithDescription>): FormlyFieldConfig {
  return {
    key,
    type: 'checkbox',
    templateOptions: {
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
