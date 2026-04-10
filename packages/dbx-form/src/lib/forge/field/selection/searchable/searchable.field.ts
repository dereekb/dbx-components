import { type PrimativeKey, filterFromPOJO } from '@dereekb/util';
import type { FieldDef, FieldTypeDefinition } from '@ng-forge/dynamic-forms';
import { valueFieldMapper } from '@ng-forge/dynamic-forms/integration';
import { forgeField } from '../../field';
import { forgeFormFieldWrapper, type DbxForgeFormFieldWrapperFieldDef } from '../../wrapper/formfield/formfield.field';
import { FORGE_SEARCHABLE_TEXT_FIELD_TYPE, FORGE_SEARCHABLE_CHIP_FIELD_TYPE, type DbxForgeSearchableTextFieldProps, type DbxForgeSearchableTextFieldDef, type DbxForgeSearchableChipFieldProps, type DbxForgeSearchableChipFieldDef } from './searchable.field.directive';

// MARK: Field Type Definitions
/**
 * ng-forge FieldTypeDefinition for the searchable text field.
 *
 * Register via `provideDynamicForm(DBX_SEARCHABLE_TEXT_FIELD_TYPE)`.
 */
export const DBX_SEARCHABLE_TEXT_FIELD_TYPE: FieldTypeDefinition<DbxForgeSearchableTextFieldDef> = {
  name: FORGE_SEARCHABLE_TEXT_FIELD_TYPE,
  loadComponent: () => import('./searchable-text.field.component').then((m) => m.DbxForgeSearchableTextFieldComponent),
  mapper: valueFieldMapper
};

/**
 * ng-forge FieldTypeDefinition for the searchable chip field.
 *
 * Register via `provideDynamicForm(DBX_SEARCHABLE_CHIP_FIELD_TYPE)`.
 */
export const DBX_SEARCHABLE_CHIP_FIELD_TYPE: FieldTypeDefinition<DbxForgeSearchableChipFieldDef> = {
  name: FORGE_SEARCHABLE_CHIP_FIELD_TYPE,
  loadComponent: () => import('./searchable-chip.field.component').then((m) => m.DbxForgeSearchableChipFieldComponent),
  mapper: valueFieldMapper
};

// MARK: Searchable Text Field
/**
 * Configuration for a forge searchable text field (single-value autocomplete).
 */
export interface DbxForgeSearchableTextFieldConfig<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends DbxForgeSearchableTextFieldProps<T, M, H> {
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
 * @returns A validated {@link DbxForgeSearchableTextFieldDef}
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
export function forgeSearchableTextField<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey>(config: DbxForgeSearchableTextFieldConfig<T, M, H>): DbxForgeFormFieldWrapperFieldDef<DbxForgeSearchableTextFieldDef<T, M, H>> {
  const { key, label, placeholder, required, readonly: isReadonly, description, ...searchProps } = config;

  const innerField = forgeField(
    filterFromPOJO({
      key,
      type: FORGE_SEARCHABLE_TEXT_FIELD_TYPE,
      label: '',
      placeholder,
      value: undefined as unknown as T,
      required,
      readonly: isReadonly,
      props: filterFromPOJO({
        ...searchProps
      }) as DbxForgeSearchableTextFieldProps<T, M, H>
    }) as DbxForgeSearchableTextFieldDef<T, M, H>
  );

  return forgeFormFieldWrapper<DbxForgeSearchableTextFieldDef<T, M, H>>({
    label: label ?? '',
    hint: description,
    fields: [innerField as unknown as FieldDef<unknown>]
  });
}

// MARK: Searchable Chip Field
/**
 * Configuration for a forge searchable chip field (multi-value autocomplete with chips).
 */
export interface DbxForgeSearchableChipFieldConfig<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends DbxForgeSearchableChipFieldProps<T, M, H> {
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
 * @returns A validated {@link DbxForgeSearchableChipFieldDef}
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
export function forgeSearchableChipField<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey>(config: DbxForgeSearchableChipFieldConfig<T, M, H>): DbxForgeFormFieldWrapperFieldDef<DbxForgeSearchableChipFieldDef<T, M, H>> {
  const { key, label, placeholder, required, readonly: isReadonly, description, ...chipProps } = config;

  const innerField = forgeField(
    filterFromPOJO({
      key,
      type: FORGE_SEARCHABLE_CHIP_FIELD_TYPE,
      label: '',
      placeholder,
      value: undefined as unknown as T | T[],
      required,
      readonly: isReadonly,
      props: filterFromPOJO({
        ...chipProps
      }) as DbxForgeSearchableChipFieldProps<T, M, H>
    }) as DbxForgeSearchableChipFieldDef<T, M, H>
  );

  return forgeFormFieldWrapper<DbxForgeSearchableChipFieldDef<T, M, H>>({
    label: label ?? '',
    hint: description,
    fields: [innerField as unknown as FieldDef<unknown>]
  });
}

/**
 * Creates a forge searchable chip field pre-configured for string values.
 *
 * @param config - String-specific searchable chip field configuration (omits allowStringValues)
 * @returns A validated {@link DbxForgeSearchableChipFieldDef}
 */
export function forgeSearchableStringChipField<M = unknown>(config: Omit<DbxForgeSearchableChipFieldConfig<string, M>, 'allowStringValues'>): DbxForgeFormFieldWrapperFieldDef<DbxForgeSearchableChipFieldDef<string, M>> {
  return forgeSearchableChipField({
    ...config,
    allowStringValues: true
  });
}
