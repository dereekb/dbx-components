import { FormlyFieldConfig } from '@ngx-formly/core';
import { Maybe, searchStringFilterFunction, SearchStringFilterFunction, caseInsensitiveFilterByIndexOfDecisionFactory, sortByStringFunction } from '@dereekb/util';
import { Observable, of } from 'rxjs';
import { LabeledFieldConfig, formlyField, propsAndConfigForFieldConfig, MaterialFormFieldConfig } from '../../field';
import { PickableValueFieldDisplayValue } from './pickable';
import { PickableItemFieldItem, PickableValueFieldsFieldProps } from './pickable.field.directive';
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
