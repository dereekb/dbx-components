import { type FormlyFieldConfig } from '@ngx-formly/core';
import { type LabeledFieldConfig, formlyField, propsAndConfigForFieldConfig, type MaterialFormFieldConfig } from '../../field';
import { type PickableValueFieldsFieldProps } from './pickable.field.directive';

/**
 * Configuration for a pickable item field that displays selected values as chips or a list.
 */
export interface PickableItemFieldConfig<T = unknown, M = unknown> extends LabeledFieldConfig, PickableValueFieldsFieldProps<T, M>, MaterialFormFieldConfig {}

/**
 * Creates a Formly field configuration for a pickable chip field that displays
 * selected values as Material chips.
 *
 * @param config - Pickable item configuration including load and display functions
 * @returns A validated {@link FormlyFieldConfig} with type `'pickablechipfield'`
 *
 * @example
 * ```typescript
 * const field = pickableItemChipField({
 *   key: 'tags',
 *   label: 'Tags',
 *   loadValues: () => tags$,
 *   hashForValue: (tag) => tag.id
 * });
 * ```
 */
export function pickableItemChipField<T = unknown, M = unknown>(config: PickableItemFieldConfig<T, M>): FormlyFieldConfig {
  const { key, materialFormField } = config;
  return formlyField({
    key,
    type: 'pickablechipfield',
    ...propsAndConfigForFieldConfig(config, {
      ...materialFormField,
      ...config,
      autocomplete: false
    })
  });
}

/**
 * Creates a Formly field configuration for a pickable list field that displays
 * selected values in a selection list.
 *
 * @param config - Pickable item configuration including load and display functions
 * @returns A validated {@link FormlyFieldConfig} with type `'pickablelistfield'`
 *
 * @example
 * ```typescript
 * const field = pickableItemListField({
 *   key: 'categories',
 *   label: 'Categories',
 *   loadValues: () => categories$,
 *   hashForValue: (cat) => cat.id
 * });
 * ```
 */
export function pickableItemListField<T = unknown, M = unknown>(config: PickableItemFieldConfig<T, M>): FormlyFieldConfig {
  const { key, materialFormField } = config;
  return formlyField({
    key,
    type: 'pickablelistfield',
    ...propsAndConfigForFieldConfig(config, {
      ...materialFormField,
      ...config,
      autocomplete: false
    })
  });
}
