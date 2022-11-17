import { ArrayOrValue, asArray } from '@dereekb/util';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { FieldConfig, formlyField, propsAndConfigForFieldConfig } from '../../field';
import { DbxFormRepeatArrayConfig } from './array.field.component';

export interface RepeatArrayFieldConfig extends DbxFormRepeatArrayConfig, FieldConfig {
  label?: string;
  repeatFieldGroup: ArrayOrValue<FormlyFieldConfig>;
  maxLength?: number;
}

export function repeatArrayField(config: RepeatArrayFieldConfig) {
  const { key, repeatFieldGroup, maxLength, addText, removeText, labelForField } = config;

  return formlyField({
    key,
    type: 'repeatarray',
    ...propsAndConfigForFieldConfig(config, {
      maxLength,
      labelForField,
      addText,
      removeText
    }),
    fieldArray: {
      fieldGroup: asArray(repeatFieldGroup)
    }
  });
}
