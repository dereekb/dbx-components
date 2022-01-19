import { arrayToMap, separateValues } from '@/app/common/utility';
import { Observable, of, merge } from 'rxjs';
import { map } from 'rxjs/operators';
import { FieldConfig, formlyField } from '../field';
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

export interface SearchableChipFieldConfig<T = any> extends FieldConfig, SearchableChipValueFieldsFieldConfig<T> { }
export interface SearchableChipFieldFormlyConfig<T = any> extends Omit<SearchableChipValueFieldsFormlyFieldConfig<T>, 'type'> { }

export function searchableChipField<C extends SearchableChipFieldFormlyConfig<any>>(config: C): C {
  return formlyField<C>({
    type: 'searchablechipfield',
    ...config
  });
}

export interface SearchableTextFieldConfig<T = any> extends FieldConfig, SearchableTextValueFieldsFieldConfig<T> { }
export interface SearchableTextFieldFormlyConfig<T = any> extends Omit<SearchableTextValueFieldsFormlyFieldConfig<T>, 'type'> { }

export function searchableTextField<C extends SearchableTextFieldFormlyConfig<any>>(config: C): C {
  return formlyField<C>({
    type: 'searchabletextfield',
    ...config
  });
}
