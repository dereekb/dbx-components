import { LabeledFieldConfig, formlyField } from '../field';
import { DbxChecklistItemFieldConfig, ChecklistItemFormlyFieldConfig } from './checklist.item.field.component';

export interface ChecklistItemFieldConfig<T = any> extends LabeledFieldConfig, DbxChecklistItemFieldConfig<T> { }
export type ChecklistItemFieldBuilderInput<T = any> = Partial<ChecklistItemFieldConfig<T>> & Pick<ChecklistItemFieldConfig<T>, 'key' | 'displayContentObs'>;

export function checklistItemField<T = any>({
  key,
  label = '',
  placeholder = '',
  displayContentObs,
  componentClass,
  required = false
}: ChecklistItemFieldBuilderInput<T>
): ChecklistItemFormlyFieldConfig<T> {
  const fieldConfig: ChecklistItemFormlyFieldConfig = formlyField({
    key,
    type: 'checklistitem',
    templateOptions: {
      label,
      placeholder,
      required
    },
    displayContentObs,
    componentClass
  });

  return fieldConfig;
}
