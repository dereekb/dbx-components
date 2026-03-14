import { type ArrayOrValue, asArray } from '@dereekb/util';
import { type FormlyFieldConfig } from '@ngx-formly/core';
import { type FieldConfig, formlyField, propsAndConfigForFieldConfig } from '../../field';
import { type DbxFormRepeatArrayConfig } from './array.field.component';

/**
 * Configuration for a repeat-array field that allows users to dynamically add/remove
 * groups of fields (e.g., multiple addresses, phone numbers).
 */
export interface RepeatArrayFieldConfig<T = unknown> extends DbxFormRepeatArrayConfig<T>, FieldConfig {
  /** Field group template that is repeated for each array entry. */
  repeatFieldGroup: ArrayOrValue<FormlyFieldConfig>;
}

/**
 * Creates a Formly field configuration for a repeatable array of field groups.
 *
 * Users can dynamically add, remove, duplicate, and rearrange entries.
 *
 * @param config - Repeat array configuration including the template field group
 * @returns A validated {@link FormlyFieldConfig} with type `'repeatarray'`
 *
 * @example
 * ```typescript
 * const field = repeatArrayField({
 *   key: 'items',
 *   label: 'Items',
 *   addText: 'Add Item',
 *   removeText: 'Remove Item',
 *   repeatFieldGroup: [textField({ key: 'name', label: 'Name' })]
 * });
 * ```
 */
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
