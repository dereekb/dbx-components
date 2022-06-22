import { FormlyFieldConfig } from '@ngx-formly/core';
import { FieldConfig, formlyField, propsForFieldConfig } from '../../field';
import { DbxFormRepeatArrayConfig } from './array.field.component';

export interface RepeatArrayFieldConfig extends DbxFormRepeatArrayConfig, FieldConfig {
  label?: string;
  repeatFieldGroup: FormlyFieldConfig[];
  maxLength?: number;
}

export function repeatArrayField(config: RepeatArrayFieldConfig) {
  const { key, repeatFieldGroup, maxLength, addText, removeText, labelForField } = config;

  return formlyField({
    key,
    type: 'repeatarray',
    ...propsForFieldConfig(config, {
      maxLength,
      labelForField,
      addText,
      removeText
    }),
    fieldArray: {
      fieldGroup: repeatFieldGroup
    }
  });
}
