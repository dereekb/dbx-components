import { FormlyFieldConfig } from '@ngx-formly/core';
import { Maybe, searchStringFilterFunction, SearchStringFilterFunction, caseInsensitiveFilterByIndexOfDecisionFactory } from '@dereekb/util';
import { Observable, of } from 'rxjs';
import { LabeledFieldConfig, formlyField, propsForFieldConfig } from '../../field';
import { PickableValueFieldDisplayValue } from './pickable';
import { PickableItemFieldItem, PickableValueFieldsFieldProps } from './pickable.field.directive';
export { PickableItemFieldItem };

export const filterPickableItemFieldValuesByLabelFilterFunction: SearchStringFilterFunction<PickableValueFieldDisplayValue<any>> = searchStringFilterFunction({
  readStrings: (x) => [x.label],
  decisionFactory: caseInsensitiveFilterByIndexOfDecisionFactory
});

export function filterPickableItemFieldValuesByLabel<T>(filterText: Maybe<string>, values: PickableValueFieldDisplayValue<T>[]): Observable<T[]> {
  let filteredValues: PickableValueFieldDisplayValue<T>[];

  if (filterText) {
    filteredValues = filterPickableItemFieldValuesByLabelFilterFunction(filterText, values);
  } else {
    filteredValues = values;
  }

  return of(filteredValues.map((x) => x.value));
}

export function sortPickableItemsByLabel<T>(chips: PickableItemFieldItem<T>[]): PickableItemFieldItem<T>[] {
  return chips.sort((a, b) => a.itemValue.label.localeCompare(b.itemValue.label));
}

export interface PickableItemFieldConfig<T = unknown, M = unknown> extends LabeledFieldConfig, PickableValueFieldsFieldProps<T, M> {}

export function pickableItemChipField<T = unknown, M = unknown>(config: PickableItemFieldConfig<T, M>): FormlyFieldConfig {
  const { key } = config;
  return formlyField({
    key,
    type: 'pickablechipfield',
    ...propsForFieldConfig(config, {
      ...config,
      autocomplete: false
    })
  });
}

export function pickableItemListField<T = unknown, M = unknown>(config: PickableItemFieldConfig<T, M>): FormlyFieldConfig {
  const { key } = config;
  return formlyField({
    key,
    type: 'pickablelistfield',
    ...propsForFieldConfig(config, {
      ...config,
      autocomplete: false
    })
  });
}
