import { arrayToMap, type Maybe, type PrimativeKey, separateValues } from '@dereekb/util';
import { type FormlyFieldConfig } from '@ngx-formly/core';
import { type Observable, of, switchMap, map } from 'rxjs';
import { type LabeledFieldConfig, formlyField, propsAndConfigForFieldConfig, type DescriptionFieldConfig, type MaterialFormFieldConfig } from '../../field';
import { type SearchableValueFieldDisplayFn, type SearchableValueFieldDisplayValue, type SearchableValueFieldValue } from './searchable';
import { type SearchableChipValueFieldsFieldProps } from './searchable.chip.field.component';
import { type SearchableTextValueFieldsFieldProps } from './searchable.text.field.component';

/**
 * Used to create a SearchableValueFieldDisplayFn function that will retrieve the metadata for items that are missing their metadata so they can be displayed properly.
 *
 * @param param0 - Configuration object
 * @param param0.loadMetaForValues - Function to load metadata for values that are missing it
 * @param param0.makeDisplayForValues - Function to convert values with metadata into display values
 * @returns A display function that lazily loads metadata before generating display values
 */
export function formlyMakeMetaFilterSearchableFieldValueDisplayFn<T extends string | number = string | number, M = unknown>({ loadMetaForValues, makeDisplayForValues }: { loadMetaForValues: (values: SearchableValueFieldValue<T, M>[]) => Observable<SearchableValueFieldValue<T, M>[]>; makeDisplayForValues: (values: SearchableValueFieldValue<T, M>[]) => Observable<SearchableValueFieldDisplayValue<T, M>[]> }): SearchableValueFieldDisplayFn<T, M> {
  return (values: SearchableValueFieldValue<T, M>[]) => {
    const { included: loaded, excluded: needLoading } = separateValues(values, (x) => Boolean(x.meta));
    let allValues: Observable<SearchableValueFieldValue<T, M>[]>;

    if (needLoading.length > 0) {
      const loadingResult = loadMetaForValues(needLoading);
      allValues = loadingResult.pipe(
        map((result) => {
          const resultMap: Map<Maybe<T>, SearchableValueFieldValue<T, M>> = arrayToMap(result, (x) => x.value);

          return needLoading.map((x) => {
            const id = x.value;
            const loadedItem = resultMap.get(id);
            const anchor = x.anchor ?? loadedItem?.anchor;
            const meta: Maybe<M> = loadedItem?.meta;

            return {
              ...x,
              anchor,
              meta
            };
          });
        }),
        map((result) => [...loaded, ...result])
      );
    } else {
      allValues = of(loaded);
    }

    return allValues.pipe(switchMap(makeDisplayForValues));
  };
}

// MARK: Chips
/**
 * Configuration for a searchable chip field that uses string values directly.
 */
export type StringSearchableChipFieldConfig<M = unknown> = Omit<SearchableChipFieldConfig<string, M>, 'allowStringValues'>;

/**
 * Creates a searchable chip field pre-configured for string values.
 *
 * @param config - String-specific searchable chip field configuration
 * @returns A {@link FormlyFieldConfig} with type `'searchablechipfield'`
 *
 * @example
 * ```typescript
 * const field = formlySearchableStringChipField({ key: 'tags', label: 'Tags', search: searchFn });
 * ```
 */
export function formlySearchableStringChipField<M = unknown>(config: StringSearchableChipFieldConfig<M>): FormlyFieldConfig {
  return formlySearchableChipField({
    ...config,
    allowStringValues: true
  });
}

/**
 * Full configuration for a searchable chip field combining labeling, description,
 * Material styling, and searchable chip behavior.
 */
export interface SearchableChipFieldConfig<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends LabeledFieldConfig, DescriptionFieldConfig, MaterialFormFieldConfig, SearchableChipValueFieldsFieldProps<T, M, H> {}

/**
 * Creates a Formly field configuration for a searchable chip field where users
 * can search for and select values displayed as Material chips.
 *
 * @param config - Searchable chip field configuration
 * @returns A validated {@link FormlyFieldConfig} with type `'searchablechipfield'`
 *
 * @example
 * ```typescript
 * const field = formlySearchableChipField({ key: 'skills', label: 'Skills', search: searchFn, hashForValue: (s) => s.id });
 * ```
 */
export function formlySearchableChipField<T, M = unknown, H extends PrimativeKey = PrimativeKey>(config: SearchableChipFieldConfig<T, M, H>): FormlyFieldConfig {
  const { key, placeholder, materialFormField } = config;
  return formlyField({
    key,
    type: 'searchablechipfield',
    ...propsAndConfigForFieldConfig(config, {
      ...materialFormField,
      ...config,
      placeholder: placeholder ?? 'Add...',
      autocomplete: false
    })
  });
}

// MARK: Text
/**
 * Full configuration for a searchable text field with autocomplete.
 */
export interface SearchableTextFieldConfig<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends LabeledFieldConfig, DescriptionFieldConfig, MaterialFormFieldConfig, SearchableTextValueFieldsFieldProps<T, M, H> {}

/**
 * Creates a Formly field configuration for a searchable text field with autocomplete
 * dropdown for selecting values.
 *
 * @param config - Searchable text field configuration
 * @returns A validated {@link FormlyFieldConfig} with type `'searchabletextfield'`
 *
 * @example
 * ```typescript
 * const field = formlySearchableTextField({ key: 'assignee', label: 'Assignee', search: searchFn });
 * ```
 */
export function formlySearchableTextField<T, M = unknown, H extends PrimativeKey = PrimativeKey>(config: SearchableTextFieldConfig<T, M, H>): FormlyFieldConfig {
  const { key, materialFormField } = config;
  return formlyField({
    key,
    type: 'searchabletextfield',
    ...propsAndConfigForFieldConfig(config, {
      ...materialFormField,
      ...config,
      autocomplete: false
    })
  });
}

// MARK: Deprecated
/**
 * @deprecated Use formlyMakeMetaFilterSearchableFieldValueDisplayFn instead.
 */
export const makeMetaFilterSearchableFieldValueDisplayFn = formlyMakeMetaFilterSearchableFieldValueDisplayFn;
/**
 * @deprecated Use formlySearchableStringChipField instead.
 */
export const searchableStringChipField = formlySearchableStringChipField;
/**
 * @deprecated Use formlySearchableChipField instead.
 */
export const searchableChipField = formlySearchableChipField;
/**
 * @deprecated Use formlySearchableTextField instead.
 */
export const searchableTextField = formlySearchableTextField;
