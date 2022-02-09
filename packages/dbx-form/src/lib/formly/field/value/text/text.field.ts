import { FormlyFieldConfig } from '@ngx-formly/core/lib/core';
import { AttributesFieldConfig, LabeledFieldConfig, formlyField } from '../../field';

export interface TextFieldLengthConfig {
  minLength?: number;
  maxLength?: number;
}

export interface TextFieldConfig extends LabeledFieldConfig, TextFieldLengthConfig, AttributesFieldConfig {
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

export interface TextAreaFieldConfig extends LabeledFieldConfig, TextFieldLengthConfig, AttributesFieldConfig {
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
