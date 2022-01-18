import { FormlyFieldConfig } from '@ngx-formly/core';
import { FieldConfig, FieldConfigWithDescription, formlyField } from './field';

export function toggleField({ key, label, description, defaultValue, required }: FieldConfigWithDescription<boolean>): FormlyFieldConfig {
  return formlyField({
    key,
    type: 'toggle',
    wrappers: ['autotouch', 'form-field'],  // NOTE: Must specify form-field if other wrapper specified, otherwise it will not be used.
    defaultValue: defaultValue ?? false,
    templateOptions: {
      label,
      description,
      required
    }
  });
}

export function agreeField({ key = 'agree', label = '', placeholder = '', required = true }: Partial<FieldConfig>): FormlyFieldConfig {
  return {
    key,
    type: 'checkbox',
    templateOptions: {
      label,
      placeholder,
      required
    },
  };
}

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
