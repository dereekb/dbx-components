import { FormlyFieldConfig } from '@ngx-formly/core';
import { FieldConfig, formlyField, templateOptionsForFieldConfig } from "../../field";
import { DbxFormRepeatArrayConfig } from './array.field.component';

export interface RepeatArrayFieldConfig extends DbxFormRepeatArrayConfig, FieldConfig {
  label?: string;
  repeatFieldGroup: FormlyFieldConfig[];
  maxLength?: number;
}

export function repeatArrayField(config: RepeatArrayFieldConfig): FormlyFieldConfig {
  const { key, repeatFieldGroup, maxLength, addText, removeText, labelForField } = config;

  return formlyField({
    key,
    type: 'repeatarray',
    repeatArrayField: {
      labelForField,
      addText,
      removeText,
    },
    ...templateOptionsForFieldConfig(config, {
      maxLength
    }),
    fieldArray: {
      fieldGroup: repeatFieldGroup
    }
  });
}
