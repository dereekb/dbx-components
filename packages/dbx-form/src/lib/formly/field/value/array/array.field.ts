import { FormlyFieldConfig } from '@ngx-formly/core';
import { FieldConfig } from "../../field";
import { DbxFormRepeatArrayConfig } from './array.field.component';

export interface RepeatArrayFieldConfig extends DbxFormRepeatArrayConfig, FieldConfig {
  label?: string;
  repeatFieldGroup: FormlyFieldConfig[];
  maxLength?: number;
}

export function repeatArrayField({ key, label, required = false, repeatFieldGroup, maxLength, addText, removeText, labelForField }: RepeatArrayFieldConfig): FormlyFieldConfig {
  return {
    key,
    type: 'repeatarray',
    templateOptions: {
      label,
      required,
      repeatSection: {
        labelForField,
        addText,
        removeText,
      },
      maxLength
    },
    fieldArray: {
      fieldGroup: repeatFieldGroup
    }
  };
}
