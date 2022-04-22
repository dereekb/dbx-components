import { FormlyFieldConfig } from '@ngx-formly/core';
import { Maybe } from '@dereekb/util';
import { Observable, of } from 'rxjs';
import { LabeledFieldConfig, formlyField, templateOptionsForFieldConfig } from '../../field';
import { PickableValueFieldDisplayValue } from './pickable';
import { PickableItemFieldItem, PickableValueFieldsFieldConfig, PickableValueFieldsFormlyFieldConfig } from './pickable.field.directive';
export { PickableItemFieldItem };

export function filterPickableItemFieldValuesByLabel<T>(filterText: Maybe<string>, values: PickableValueFieldDisplayValue<T>[]): Observable<T[]> {
  let filteredValues: PickableValueFieldDisplayValue<T>[];

  if (filterText) {
    const searchString = filterText.toLocaleLowerCase();
    filteredValues = values.filter(x => x.label.toLocaleLowerCase().indexOf(searchString) !== -1);
  } else {
    filteredValues = values;
  }

  return of(filteredValues.map(x => x.value));
}

export function sortPickableItemsByLabel<T>(chips: PickableItemFieldItem<T>[]): PickableItemFieldItem<T>[] {
  return chips.sort((a, b) => a.itemValue.label.localeCompare(b.itemValue.label));
}

export interface PickableItemFieldConfig<T = any> extends LabeledFieldConfig, PickableValueFieldsFieldConfig<T> { }

export function pickableItemChipField<T = any>(config: PickableItemFieldConfig<T>): FormlyFieldConfig {
  const { key } = config;
  return formlyField({
    key,
    type: 'pickablechipfield',
    ...templateOptionsForFieldConfig(config, {
      autocomplete: false
    }),
    pickableField: config
  });
}

export function pickableItemListField<T = any>(config: PickableItemFieldConfig<T>): FormlyFieldConfig {
  const { key } = config;
  return formlyField({
    key,
    type: 'pickablelistfield',
    ...templateOptionsForFieldConfig(config, {
      autocomplete: false
    }),
    pickableField: config
  });
}
