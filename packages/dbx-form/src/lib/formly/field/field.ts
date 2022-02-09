import { FormlyFieldConfig } from '@ngx-formly/core';

export interface FieldConfig {
  key: string;
  required?: boolean;
  readonly?: boolean;
}

export interface LabeledFieldConfig extends FieldConfig {
  key: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  readonly?: boolean;
  autocomplete?: string;
}

export interface DefaultValueFieldConfig<T = any> {
  defaultValue?: T;
}

export interface AttributesFieldConfig {
  attributes?: {
    [key: string]: string | number
  }
}

export interface DescriptionFieldConfig {
  description?: string;
}

/**
 * Validates the configuration on the input field.
 */
export function formlyField<T extends FormlyFieldConfig = FormlyFieldConfig>(fieldConfig: T): T {
  if (!fieldConfig.key) {
    console.error(fieldConfig);
    throw new Error(`Field had a null key.`);
  }

  return fieldConfig;
}

/**
 * Returns configuration for a formlyField that will disable autofill/autocomplete for a field.
 */
export function disableFormlyFieldAutofill(): { name: string, autocomplete: string } {
  // https://stackoverflow.com/questions/15738259/disabling-chrome-autofill
  return {
    name: 'password',
    autocomplete: 'off'
  };
}
