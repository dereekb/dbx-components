import { FormlyFieldConfig } from '@ngx-formly/core';
import { LabeledFieldConfig, formlyField, propsAndConfigForFieldConfig } from '../field';
import { DbxChecklistItemFieldProps } from './checklist.item.field.component';

export interface ChecklistItemFieldConfig<T = unknown> extends LabeledFieldConfig, DbxChecklistItemFieldProps<T> {}
export type ChecklistItemFieldBuilderInput<T = unknown> = Partial<ChecklistItemFieldConfig<T>> & Pick<ChecklistItemFieldConfig<T>, 'key' | 'displayContent'>;

export function checklistItemField<T = unknown>(config: ChecklistItemFieldBuilderInput<T>): FormlyFieldConfig<DbxChecklistItemFieldProps<T>> {
  const { key, displayContent, componentClass } = config;

  const fieldConfig = formlyField({
    key,
    type: 'checklistitem',
    ...propsAndConfigForFieldConfig(config, {
      displayContent,
      componentClass
    })
  });

  return fieldConfig;
}
