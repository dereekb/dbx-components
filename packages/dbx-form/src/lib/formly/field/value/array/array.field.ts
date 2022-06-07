import { FormlyFieldConfig } from '@ngx-formly/core';
import { FieldConfig, formlyField, propsForFieldConfig } from '../../field';
import { DbxFormRepeatArrayConfig, DbxFormRepeatArrayFormlyConfig } from './array.field.component';

export interface RepeatArrayFieldConfig extends DbxFormRepeatArrayConfig, FieldConfig {
  label?: string;
  repeatFieldGroup: FormlyFieldConfig[];
  maxLength?: number;
}

export function repeatArrayField(config: RepeatArrayFieldConfig): DbxFormRepeatArrayFormlyConfig {
  const { key, repeatFieldGroup, maxLength, addText, removeText, labelForField } = config;

  return formlyField({
    key,
    type: 'repeatarray',
    repeatArrayField: {
      labelForField,
      addText,
      removeText
    },
    ...propsForFieldConfig(config, {
      maxLength
    }),
    fieldArray: {
      fieldGroup: repeatFieldGroup
    }
  }) as DbxFormRepeatArrayFormlyConfig;
}
