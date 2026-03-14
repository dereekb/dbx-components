import { type FormlyFieldConfig } from '@ngx-formly/core';
import { type LabeledFieldConfig, formlyField, propsAndConfigForFieldConfig } from '../field';
import { type DbxChecklistItemFieldProps } from './checklist.item.field.component';

/**
 * Full configuration for a single checklist item field.
 */
export interface ChecklistItemFieldConfig<T = unknown> extends LabeledFieldConfig, DbxChecklistItemFieldProps<T> {}

/**
 * Builder input for creating a checklist item field. Requires `key` and `displayContent`;
 * all other properties are optional.
 */
export type ChecklistItemFieldBuilderInput<T = unknown> = Partial<ChecklistItemFieldConfig<T>> & Pick<ChecklistItemFieldConfig<T>, 'key' | 'displayContent'>;

/**
 * Creates a Formly field configuration for a single checklist item with a checkbox
 * and display content (label, sublabel, description, anchor).
 *
 * @param config - Checklist item configuration with key and display content
 * @returns A validated {@link FormlyFieldConfig} with type `'checklistitem'`
 *
 * @example
 * ```typescript
 * const field = checklistItemField({
 *   key: 'emailNotifications',
 *   displayContent: of({ label: 'Email Notifications', description: 'Receive updates via email' })
 * });
 * ```
 */
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
