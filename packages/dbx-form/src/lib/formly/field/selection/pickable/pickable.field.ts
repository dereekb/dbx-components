import { type FormlyFieldConfig } from '@ngx-formly/core';
import { type LabeledFieldConfig, formlyField, propsAndConfigForFieldConfig, type MaterialFormFieldConfig } from '../../field';
import { PickableItemFieldItem, type PickableValueFieldsFieldProps } from './pickable.field.directive';
export { PickableItemFieldItem };

export interface PickableItemFieldConfig<T = unknown, M = unknown> extends LabeledFieldConfig, PickableValueFieldsFieldProps<T, M>, MaterialFormFieldConfig {}

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
