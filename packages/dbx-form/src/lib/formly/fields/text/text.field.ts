import { Validators, AbstractControl } from '@angular/forms';
import { FormlyFieldConfig } from '@ngx-formly/core/lib/core';
import { AttributesFieldConfig, FieldConfig, formlyField, DescriptionFieldConfig } from '../field';

export const PHONE_LABEL_MAX_LENGTH = 100;

export const ADDRESS_COUNTRY_MAX_LENGTH = 80;
export const ADDRESS_CITY_MAX_LENGTH = 80;
export const ADDRESS_STATE_MAX_LENGTH = 80;
export const ADDRESS_ZIP_MAX_LENGTH = 20;

export const LABEL_STRING_MAX_LENGTH = 100;
export const SEARCH_STRING_MAX_LENGTH = 100;

export interface TextFieldLengthConfig {
  minLength?: number;
  maxLength?: number;
}

export interface TextFieldConfig extends FieldConfig, TextFieldLengthConfig, AttributesFieldConfig {
  pattern?: string | RegExp;
}

export function textField({ key, label = '', placeholder = '', required = false, attributes, readonly, autocomplete, minLength, maxLength, pattern }: TextFieldConfig): FormlyFieldConfig {
  return formlyField({
    key,
    type: 'input',
    templateOptions: {
      label,
      placeholder,
      required,
      minLength,
      maxLength,
      pattern,
      readonly,
      attributes: {
        ...attributes,
        ...(autocomplete) ? { autocomplete } : undefined
      }
    }
  });
}

export interface TextAreaFieldConfig extends FieldConfig, TextFieldLengthConfig, AttributesFieldConfig {
  rows?: number;
}

export function textAreaField({ key, label = '', placeholder = '', rows = 3, required = false, minLength, maxLength = 1000, attributes }: TextAreaFieldConfig): FormlyFieldConfig {
  return formlyField({
    key,
    type: 'textarea',
    templateOptions: {
      label,
      placeholder,
      required,
      rows,
      minLength,
      maxLength,
      attributes
    }
  });
}

export function nameField({ key = 'name', label = 'Name', placeholder = 'John Doe', required = false, minLength, maxLength, attributes }: Partial<TextFieldConfig> = {}): FormlyFieldConfig {
  return textField({
    key,
    label,
    placeholder,
    required,
    minLength,
    maxLength,
    attributes
  });
}

export interface EmailFieldConfig extends FieldConfig, DescriptionFieldConfig {
  rows?: number;
}

export function emailField({ key = 'email', label = 'Email Address', placeholder = 'person@email.com', description = '', required = false, readonly = false }: EmailFieldConfig): FormlyFieldConfig {
  return formlyField({
    key,
    type: 'input',
    templateOptions: {
      label,
      placeholder,
      description,
      required,
      readonly
    },
    validation: {
      messages: {
        required: `Email is required.`
      }
    },
    validators: {
      email: {
        expression: (c: AbstractControl) => !Validators.email(c),
        message: () => `Not a valid email address.`
      }
    },
  });
}

export function cityField({ key = 'city', required = false }): FormlyFieldConfig {
  return textField({
    key,
    label: 'City',
    placeholder: '',
    required,
    autocomplete: 'city',
    maxLength: ADDRESS_CITY_MAX_LENGTH
  });
}

export function stateField({ key = 'state', required = false }): FormlyFieldConfig {
  return textField({
    key,
    label: 'State',
    placeholder: '',
    required,
    attributes: {
      autocomplete: 'state'
    },
    maxLength: ADDRESS_STATE_MAX_LENGTH
  });
}

export function countryField({ key = 'country', required = false }): FormlyFieldConfig {
  return textField({
    key,
    label: 'Country',
    placeholder: '',
    required,
    attributes: {
      autocomplete: 'country'
    },
    maxLength: ADDRESS_COUNTRY_MAX_LENGTH
  });
}

export function zipCodeField({ key = 'zip', required = false }): FormlyFieldConfig {
  return textField({
    key,
    label: 'Zip Code',
    placeholder: '',
    required,
    attributes: {
      autocomplete: 'postal-code'
    },
    maxLength: ADDRESS_ZIP_MAX_LENGTH
  });
}
