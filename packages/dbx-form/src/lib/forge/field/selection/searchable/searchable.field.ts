import { type PrimativeKey, filterFromPOJO } from '@dereekb/util';
import type { FieldDef, FieldTypeDefinition } from '@ng-forge/dynamic-forms';
import { valueFieldMapper } from '@ng-forge/dynamic-forms/integration';
import { forgeField } from '../../field';
import { forgeFormFieldWrapper, type ForgeFormFieldWrapperFieldDef } from '../../wrapper/formfield/formfield.field';
import { type ForgeSearchableTextFieldProps, type ForgeSearchableTextFieldDef, type ForgeSearchableChipFieldProps, type ForgeSearchableChipFieldDef } from './searchable.field.component';

// MARK: Field Type Definitions
/**
 * ng-forge FieldTypeDefinition for the searchable text field.
 *
 * Register via `provideDynamicForm(DBX_SEARCHABLE_TEXT_FIELD_TYPE)`.
 */
export const DBX_SEARCHABLE_TEXT_FIELD_TYPE: FieldTypeDefinition<ForgeSearchableTextFieldDef> = {
  name: 'dbx-searchable-text',
  loadComponent: () => import('./searchable.field.component').then((m) => m.DbxForgeSearchableTextFieldComponent),
  mapper: valueFieldMapper
};

/**
 * ng-forge FieldTypeDefinition for the searchable chip field.
 *
 * Register via `provideDynamicForm(DBX_SEARCHABLE_CHIP_FIELD_TYPE)`.
 */
export const DBX_SEARCHABLE_CHIP_FIELD_TYPE: FieldTypeDefinition<ForgeSearchableChipFieldDef> = {
  name: 'dbx-searchable-chip',
  loadComponent: () => import('./searchable.field.component').then((m) => m.DbxForgeSearchableChipFieldComponent),
  mapper: valueFieldMapper
};

// MARK: Searchable Text Field
/**
 * Configuration for a forge searchable text field (single-value autocomplete).
 */
export interface ForgeSearchableTextFieldConfig<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends ForgeSearchableTextFieldProps<T, M, H> {
  readonly key: string;
  readonly label?: string;
  readonly placeholder?: string;
  readonly required?: boolean;
  readonly readonly?: boolean;
  readonly description?: string;
}

/**
 * Creates a forge field definition for a searchable text field with autocomplete.
 *
 * @param config - Searchable text field configuration
 * @returns A validated {@link ForgeSearchableTextFieldDef}
 *
 * @example
 * ```typescript
 * const field = forgeSearchableTextField({
 *   key: 'assignee',
 *   label: 'Assignee',
 *   search: (text) => mySearchService.search(text),
 *   displayForValue: (values) => of(values.map(v => ({ ...v, label: v.meta?.name ?? '' })))
 * });
 * ```
 */
export function forgeSearchableTextField<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey>(config: ForgeSearchableTextFieldConfig<T, M, H>): ForgeFormFieldWrapperFieldDef<ForgeSearchableTextFieldDef<T, M, H>> {
  const { key, label, placeholder, required, readonly: isReadonly, description, ...searchProps } = config;

  const innerField = forgeField(
    filterFromPOJO({
      key,
      type: 'dbx-searchable-text' as const,
      label: '',
      placeholder,
      value: undefined as unknown as T,
      required,
      readonly: isReadonly,
      props: filterFromPOJO({
        ...searchProps
      }) as ForgeSearchableTextFieldProps<T, M, H>
    }) as ForgeSearchableTextFieldDef<T, M, H>
  );

  return forgeFormFieldWrapper<ForgeSearchableTextFieldDef<T, M, H>>({
    label: label ?? '',
    hint: description,
    fields: [innerField as unknown as FieldDef<unknown>]
  });
}

// MARK: Searchable Chip Field
/**
 * Configuration for a forge searchable chip field (multi-value autocomplete with chips).
 */
export interface ForgeSearchableChipFieldConfig<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends ForgeSearchableChipFieldProps<T, M, H> {
  readonly key: string;
  readonly label?: string;
  readonly placeholder?: string;
  readonly required?: boolean;
  readonly readonly?: boolean;
  readonly description?: string;
}

/**
 * Creates a forge field definition for a searchable chip field with autocomplete and chips.
 *
 * @param config - Searchable chip field configuration
 * @returns A validated {@link ForgeSearchableChipFieldDef}
 *
 * @example
 * ```typescript
 * const field = forgeSearchableChipField({
 *   key: 'tags',
 *   label: 'Tags',
 *   search: (text) => tagService.search(text),
 *   displayForValue: (values) => of(values.map(v => ({ ...v, label: v.meta?.name ?? '' }))),
 *   allowStringValues: true
 * });
 * ```
 */
export function forgeSearchableChipField<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey>(config: ForgeSearchableChipFieldConfig<T, M, H>): ForgeFormFieldWrapperFieldDef<ForgeSearchableChipFieldDef<T, M, H>> {
  const { key, label, placeholder, required, readonly: isReadonly, description, ...chipProps } = config;

  const innerField = forgeField(
    filterFromPOJO({
      key,
      type: 'dbx-searchable-chip' as const,
      label: '',
      placeholder,
      value: undefined as unknown as T | T[],
      required,
      readonly: isReadonly,
      props: filterFromPOJO({
        ...chipProps
      }) as ForgeSearchableChipFieldProps<T, M, H>
    }) as ForgeSearchableChipFieldDef<T, M, H>
  );

  return forgeFormFieldWrapper<ForgeSearchableChipFieldDef<T, M, H>>({
    label: label ?? '',
    hint: description,
    fields: [innerField as unknown as FieldDef<unknown>]
  });
}

/**
 * Creates a forge searchable chip field pre-configured for string values.
 *
 * @param config - String-specific searchable chip field configuration (omits allowStringValues)
 * @returns A validated {@link ForgeSearchableChipFieldDef}
 */
export function forgeSearchableStringChipField<M = unknown>(config: Omit<ForgeSearchableChipFieldConfig<string, M>, 'allowStringValues'>): ForgeFormFieldWrapperFieldDef<ForgeSearchableChipFieldDef<string, M>> {
  return forgeSearchableChipField({
    ...config,
    allowStringValues: true
  });
}
