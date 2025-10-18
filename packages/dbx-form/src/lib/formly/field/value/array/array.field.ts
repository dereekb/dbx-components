import { type ArrayOrValue, asArray } from '@dereekb/util';
import { type FormlyFieldConfig } from '@ngx-formly/core';
import { type FieldConfig, formlyField, propsAndConfigForFieldConfig } from '../../field';
import { type DbxFormRepeatArrayConfig } from './array.field.component';

export interface RepeatArrayFieldConfig<T = unknown> extends DbxFormRepeatArrayConfig<T>, FieldConfig {
  repeatFieldGroup: ArrayOrValue<FormlyFieldConfig>;
}

export function repeatArrayField<T = unknown>(config: RepeatArrayFieldConfig<T>) {
  const { key, label, description, repeatFieldGroup, maxLength, addText, addTemplate, removeText, duplicateText, labelForField, disableRearrange, allowAdd, allowRemove, allowDuplicate, addDuplicateToEnd } = config;

  return formlyField({
    key,
    type: 'repeatarray',
    ...propsAndConfigForFieldConfig(config, {
      label,
      description,
      maxLength,
      labelForField,
      addText,
      addTemplate,
      removeText,
      duplicateText,
      disableRearrange,
      allowAdd,
      allowRemove,
      allowDuplicate,
      addDuplicateToEnd
    }),
    fieldArray: {
      fieldGroup: asArray(repeatFieldGroup)
    }
  });
}
