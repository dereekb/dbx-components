import { arrayToMap, separateValues } from '@dereekb/util';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { LabeledFieldConfig, formlyField, templateOptionsForFieldConfig } from '../../field';
import { SearchableValueFieldDisplayFn, SearchableValueFieldDisplayValue, SearchableValueFieldValue } from './searchable';
import { SearchableChipValueFieldsFieldConfig, SearchableChipValueFieldsFormlyFieldConfig } from './searchable.chip.field.component';
import { SearchableTextValueFieldsFieldConfig, SearchableTextValueFieldsFormlyFieldConfig } from './searchable.text.field.component';

export function makeMetaFilterSearchableFieldValueDisplayFn<T = string | number>(
  loadMetaForValues: (values: SearchableValueFieldValue<T>[]) => Observable<SearchableValueFieldValue<T>[]>,
  makeDisplayForValues: (values: SearchableValueFieldValue<T>[]) => SearchableValueFieldDisplayValue<T>[]): SearchableValueFieldDisplayFn<T> {
  return (values: SearchableValueFieldValue<T>[]) => {
    const { included: loaded, excluded: needLoading } = separateValues(values, (x) => Boolean(x.meta));
    let allValues: Observable<SearchableValueFieldValue<T>[]>;

    if (needLoading.length > 0) {
      const loadingResult = loadMetaForValues(needLoading);
      allValues = loadingResult.pipe(
        map((result) => {
          const resultMap = arrayToMap(result, (x) => x.value as any);

          const mergedWithLoad = needLoading.map((x) => {
            const id = x.value;
            const loadedItem = resultMap.get(id);
            const anchor = x.anchor ?? loadedItem?.anchor;
            const meta = loadedItem?.meta;

            return {
              ...x,
              anchor,
              meta
            };
          }).filter(x => !x.meta);

          return mergedWithLoad;
        }),
        map((result) => [...loaded, ...result])
      );
    } else {
      allValues = of(loaded);
    }

    return allValues.pipe(map((x) => makeDisplayForValues(x)));
  };
}

// MARK: Chips
export interface StringSearchableChipFieldConfig extends Omit<SearchableChipFieldConfig<string>, 'allowStringValues'> { }

export function searchableStringChipField(config: StringSearchableChipFieldConfig): FormlyFieldConfig {
  return searchableChipField({
    ...config,
    allowStringValues: true
  });
}

export interface SearchableChipFieldConfig<T = any> extends LabeledFieldConfig, SearchableChipValueFieldsFieldConfig<T> { }

export function searchableChipField<T>(config: SearchableChipFieldConfig<T>): FormlyFieldConfig {
  const { key, placeholder } = config;
  return formlyField({
    key,
    type: 'searchablechipfield',
    ...templateOptionsForFieldConfig(config, {
      placeholder: placeholder ?? 'Add...',
      autocomplete: false
    }),
    searchableField: config
  });
}

// MARK: Text
export interface SearchableTextFieldConfig<T = any> extends LabeledFieldConfig, SearchableTextValueFieldsFieldConfig<T> { }

export function searchableTextField<T>(config: SearchableTextFieldConfig<T>): FormlyFieldConfig {
  const { key } = config;
  return formlyField({
    key,
    type: 'searchabletextfield',
    ...templateOptionsForFieldConfig(config, {
      autocomplete: false
    }),
    searchableField: config
  });
}
