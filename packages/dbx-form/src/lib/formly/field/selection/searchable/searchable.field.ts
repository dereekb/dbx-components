import { arrayToMap, Maybe, PrimativeKey, separateValues } from '@dereekb/util';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { Observable, of, switchMap, map } from 'rxjs';
import { LabeledFieldConfig, formlyField, propsAndConfigForFieldConfig, DescriptionFieldConfig } from '../../field';
import { SearchableValueFieldDisplayFn, SearchableValueFieldDisplayValue, SearchableValueFieldValue } from './searchable';
import { SearchableChipValueFieldsFieldProps } from './searchable.chip.field.component';
import { SearchableTextValueFieldsFieldProps } from './searchable.text.field.component';

/**
 * Used to create a SearchableValueFieldDisplayFn function that will retrieve the metadata for items that are missing their metadata so they can be displayed properly.
 *
 * @param param0
 * @returns
 */
export function makeMetaFilterSearchableFieldValueDisplayFn<T extends string | number = string | number, M = unknown>({ loadMetaForValues, makeDisplayForValues }: { loadMetaForValues: (values: SearchableValueFieldValue<T, M>[]) => Observable<SearchableValueFieldValue<T, M>[]>; makeDisplayForValues: (values: SearchableValueFieldValue<T, M>[]) => Observable<SearchableValueFieldDisplayValue<T, M>[]> }): SearchableValueFieldDisplayFn<T, M> {
  return (values: SearchableValueFieldValue<T, M>[]) => {
    const { included: loaded, excluded: needLoading } = separateValues(values, (x) => Boolean(x.meta));
    let allValues: Observable<SearchableValueFieldValue<T, M>[]>;

    if (needLoading.length > 0) {
      const loadingResult = loadMetaForValues(needLoading);
      allValues = loadingResult.pipe(
        map((result) => {
          const resultMap: Map<Maybe<T>, SearchableValueFieldValue<T, M>> = arrayToMap(result, (x) => x.value);

          const mergedWithLoad = needLoading
            .map((x) => {
              const id = x.value;
              const loadedItem = resultMap.get(id);
              const anchor = x.anchor ?? loadedItem?.anchor;
              const meta: M = loadedItem?.meta as M;

              return {
                ...x,
                anchor,
                meta
              };
            })
            .filter((x) => !x.meta);

          return mergedWithLoad;
        }),
        map((result) => [...loaded, ...result])
      );
    } else {
      allValues = of(loaded);
    }

    return allValues.pipe(switchMap((x) => makeDisplayForValues(x)));
  };
}

// MARK: Chips
export type StringSearchableChipFieldConfig<M = unknown> = Omit<SearchableChipFieldConfig<string, M>, 'allowStringValues'>;

export function searchableStringChipField<M = unknown>(config: StringSearchableChipFieldConfig<M>): FormlyFieldConfig {
  return searchableChipField({
    ...config,
    allowStringValues: true
  });
}

export interface SearchableChipFieldConfig<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends LabeledFieldConfig, DescriptionFieldConfig, SearchableChipValueFieldsFieldProps<T, M, H> {}

export function searchableChipField<T, M = unknown, H extends PrimativeKey = PrimativeKey>(config: SearchableChipFieldConfig<T, M, H>): FormlyFieldConfig {
  const { key, placeholder } = config;
  return formlyField({
    key,
    type: 'searchablechipfield',
    ...propsAndConfigForFieldConfig(config, {
      ...config,
      placeholder: placeholder ?? 'Add...',
      autocomplete: false
    })
  });
}

// MARK: Text
export interface SearchableTextFieldConfig<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends LabeledFieldConfig, DescriptionFieldConfig, SearchableTextValueFieldsFieldProps<T, M, H> {}

export function searchableTextField<T, M = unknown, H extends PrimativeKey = PrimativeKey>(config: SearchableTextFieldConfig<T, M, H>): FormlyFieldConfig {
  const { key } = config;
  return formlyField({
    key,
    type: 'searchabletextfield',
    ...propsAndConfigForFieldConfig(config, {
      ...config,
      autocomplete: false
    })
  });
}
