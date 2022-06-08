import { of } from 'rxjs';
import { LabeledFieldConfig } from '../../field';
import { SearchableValueFieldValue } from './searchable';
import { searchableChipField } from './searchable.field';
import { StringValueFieldsFieldProps } from './searchable.field.directive';

export interface ChipTextFieldConfig extends LabeledFieldConfig, StringValueFieldsFieldProps {
  caseSensitive?: boolean;
}

export function chipTextField(config: ChipTextFieldConfig) {
  const convertStringValue = config.caseSensitive ? (x: string) => x : (x: string) => x?.toLowerCase();

  return searchableChipField({
    search: () => of([]), // no search by default
    ...config,
    allowStringValues: true,
    convertStringValue,
    displayForValue: (values: SearchableValueFieldValue<string>[]) => {
      return of(values.map((x) => ({ ...x, label: x.value })));
    }
  });
}
