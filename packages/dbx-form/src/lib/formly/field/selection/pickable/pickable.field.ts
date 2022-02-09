import { Maybe } from '@dereekb/util';
import { Observable, of } from 'rxjs';
import { FieldConfig, formlyField } from '../../field';
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
  return chips.sort((a, b) => a.display.label.localeCompare(b.display.label));
}

export interface PickableItemFieldConfig<T = any> extends FieldConfig, PickableValueFieldsFieldConfig<T> { }
export interface PickableItemFieldFormlyConfig<T = any> extends Omit<PickableValueFieldsFormlyFieldConfig<T>, 'type'> { }

export function pickableChipItemField<C extends PickableItemFieldFormlyConfig<any>>(config: C): C {
  return formlyField<C>({
    type: 'pickablechipfield',
    ...config
  });
}

export function pickableListItemField<C extends PickableItemFieldFormlyConfig<any>>(config: C): C {
  return formlyField<C>({
    type: 'pickablelistfield',
    ...config
  });
}
