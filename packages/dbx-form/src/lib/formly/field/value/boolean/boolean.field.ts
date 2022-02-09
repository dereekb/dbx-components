import { FormlyFieldConfig } from '@ngx-formly/core';
import { LabeledFieldConfig, formlyField, DefaultValueFieldConfig, DescriptionFieldConfig } from '../../field';

export interface ToggleFieldConfig extends Omit<LabeledFieldConfig, 'placeholder' | 'autocomplete'>, DefaultValueFieldConfig<boolean>, DescriptionFieldConfig { }

export function toggleField({ key, label, description, defaultValue, required, readonly }: ToggleFieldConfig): FormlyFieldConfig {
  return formlyField({
    key,
    type: 'toggle',
    wrappers: ['autotouch', 'form-field'],  // NOTE: Must specify form-field if other wrapper specified, otherwise it will not be used.
    defaultValue: defaultValue ?? false,
    templateOptions: {
      label,
      description,
      required,
      readonly
    }
  });
}

export interface CheckboxFieldConfig extends LabeledFieldConfig, DefaultValueFieldConfig<boolean>, DescriptionFieldConfig { }

export function checkboxField({ key, label = '', placeholder = '', defaultValue, required, readonly, autocomplete }: CheckboxFieldConfig): FormlyFieldConfig {
  return {
    key,
    type: 'checkbox',
    defaultValue,
    templateOptions: {
      label,
      placeholder,
      required,
      readonly,
      autocomplete
    },
  };
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
