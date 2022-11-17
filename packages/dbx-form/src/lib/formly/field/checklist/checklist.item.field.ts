import { FormlyFieldConfig } from '@ngx-formly/core';
import { LabeledFieldConfig, formlyField, propsAndConfigForFieldConfig } from '../field';
import { DbxChecklistItemFieldProps } from './checklist.item.field.component';

export interface ChecklistItemFieldConfig<T = unknown> extends LabeledFieldConfig, DbxChecklistItemFieldProps<T> {}
export type ChecklistItemFieldBuilderInput<T = unknown> = Partial<ChecklistItemFieldConfig<T>> & Pick<ChecklistItemFieldConfig<T>, 'key' | 'displayContentObs'>;

export function checklistItemField<T = unknown>(config: ChecklistItemFieldBuilderInput<T>): FormlyFieldConfig<DbxChecklistItemFieldProps<T>> {
  const { key, displayContentObs, componentClass } = config;

  const fieldConfig = formlyField({
    key,
    type: 'checklistitem',
    ...propsAndConfigForFieldConfig(config, {
      displayContentObs,
      componentClass
    })
  });

  return fieldConfig;
}
