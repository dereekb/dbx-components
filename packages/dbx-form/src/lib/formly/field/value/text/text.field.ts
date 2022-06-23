import { FormlyFieldConfig } from '@ngx-formly/core';
import { AttributesFieldConfig, LabeledFieldConfig, formlyField, propsForFieldConfig, DescriptionFieldConfig } from '../../field';

export interface TextFieldLengthConfig {
  minLength?: number;
  maxLength?: number;
}

export type TextFieldInputType = 'text' | 'password' | 'email';

export interface TextFieldConfig extends LabeledFieldConfig, DescriptionFieldConfig, TextFieldLengthConfig, AttributesFieldConfig {
  inputType?: TextFieldInputType;
  pattern?: string | RegExp;
}

export function textField(config: TextFieldConfig): FormlyFieldConfig {
  const { key, pattern, minLength, maxLength = 1000, inputType: type = 'text' } = config;
  return formlyField({
    key,
    type: 'input',
    ...propsForFieldConfig(config, {
      type,
      minLength,
      maxLength,
      pattern
    })
  });
}

export interface TextAreaFieldConfig extends LabeledFieldConfig, DescriptionFieldConfig, TextFieldLengthConfig, AttributesFieldConfig {
  rows?: number;
}

export function textAreaField(config: TextAreaFieldConfig): FormlyFieldConfig {
  const { key, rows = 3, minLength, maxLength = 1000 } = config;
  return formlyField({
    key,
    type: 'textarea',
    ...propsForFieldConfig(config, {
      rows,
      minLength,
      maxLength
    })
  });
}
