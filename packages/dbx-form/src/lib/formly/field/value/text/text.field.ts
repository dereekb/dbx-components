import { FormlyFieldConfig } from '@ngx-formly/core/lib/core';
import { AttributesFieldConfig, LabeledFieldConfig, formlyField, templateOptionsForFieldConfig } from '../../field';

export interface TextFieldLengthConfig {
  minLength?: number;
  maxLength?: number;
}

export interface TextFieldConfig extends LabeledFieldConfig, TextFieldLengthConfig, AttributesFieldConfig {
  pattern?: string | RegExp;
}

export function textField(config: TextFieldConfig): FormlyFieldConfig {
  const { key, pattern, minLength, maxLength = 1000 } = config;
  return formlyField({
    key,
    type: 'input',
    ...templateOptionsForFieldConfig(config, {
      minLength,
      maxLength,
      pattern
    })
  });
}

export interface TextAreaFieldConfig extends LabeledFieldConfig, TextFieldLengthConfig, AttributesFieldConfig {
  rows?: number;
}

export function textAreaField(config: TextAreaFieldConfig): FormlyFieldConfig {
  const { key, rows = 3, minLength, maxLength = 1000 } = config;
  return formlyField({
    key,
    type: 'textarea',
    ...templateOptionsForFieldConfig(config, {
      rows,
      minLength,
      maxLength,
    })
  });
}
