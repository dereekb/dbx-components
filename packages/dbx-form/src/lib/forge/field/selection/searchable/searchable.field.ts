import { type PrimativeKey } from '@dereekb/util';
import type { FieldTypeDefinition } from '@ng-forge/dynamic-forms';
import { valueFieldMapper } from '@ng-forge/dynamic-forms/integration';
import { dbxForgeMaterialFormFieldWrappedFieldFunction, type DbxForgeFormFieldWrapperFieldDef } from '../../wrapper/formfield/formfield.field';
import { FORGE_SEARCHABLE_TEXT_FIELD_TYPE, FORGE_SEARCHABLE_CHIP_FIELD_TYPE, type DbxForgeSearchableTextFieldDef, type DbxForgeSearchableChipFieldDef } from './searchable.field.directive';
import { type DbxForgeFieldFunctionDef, dbxForgeFieldFunctionConfigPropsWithHintBuilder, dbxForgeBuildFieldDef } from '../../field';

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
export interface DbxForgeSearchableTextFieldConfig<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends DbxForgeFieldFunctionDef<DbxForgeSearchableTextFieldDef<T, M, H>> {}

export type DbxForgeSearchableTextFieldFunction = <T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey>(config: DbxForgeSearchableTextFieldConfig<T, M, H>) => DbxForgeFormFieldWrapperFieldDef<DbxForgeSearchableTextFieldDef<T, M, H>>;

/**
 * Creates a forge field definition for a searchable text field with autocomplete.
 *
 * @param config - Searchable text field configuration
 * @returns A {@link DbxForgeFormFieldWrapperFieldDef} wrapping a searchable text field
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
export const forgeSearchableTextField = dbxForgeMaterialFormFieldWrappedFieldFunction<DbxForgeSearchableTextFieldConfig>({
  type: FORGE_SEARCHABLE_TEXT_FIELD_TYPE,
  buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder(),
  buildFieldDef: dbxForgeBuildFieldDef(() => {
    // TODO: Ensure proper merging
    /*

  const innerField = forgeField({
    key,
    type: FORGE_SEARCHABLE_TEXT_FIELD_TYPE,
    label: '',
    placeholder,
    value: undefined as unknown as T,
    required,
    readonly: isReadonly,
  } as DbxForgeSearchableTextFieldDef<T, M, H>);

  // SAFE TO REMOVE
  /**
   * - dbxForgeFieldFunctionConfigPropsWithHintBuilder handles this
   *
    props: filterFromPOJO({
      ...searchProps
    }) as DbxForgeSearchableTextFieldProps<T, M, H>
   */
  })
}) as DbxForgeSearchableTextFieldFunction;

// MARK: Searchable Chip Field
/**
 * Configuration for a forge searchable chip field (multi-value autocomplete with chips).
 */
export interface DbxForgeSearchableChipFieldConfig<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends DbxForgeFieldFunctionDef<DbxForgeSearchableChipFieldDef<T, M, H>> {}

export type DbxForgeSearchableChipFieldFunction = <T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey>(config: DbxForgeSearchableChipFieldConfig<T, M, H>) => DbxForgeFormFieldWrapperFieldDef<DbxForgeSearchableChipFieldDef<T, M, H>>;

/**
 * Creates a forge field definition for a searchable chip field with autocomplete and chips.
 *
 * @param config - Searchable chip field configuration
 * @returns A {@link DbxForgeFormFieldWrapperFieldDef} wrapping a searchable chip field
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
export const forgeSearchableChipField = dbxForgeMaterialFormFieldWrappedFieldFunction<DbxForgeSearchableChipFieldConfig>({
  type: FORGE_SEARCHABLE_CHIP_FIELD_TYPE,
  buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder(),
  buildFieldDef: dbxForgeBuildFieldDef(() => {
    // TODO: Ensure proper merging
    /*

  const innerField = forgeField({
    key,
    type: FORGE_SEARCHABLE_CHIP_FIELD_TYPE,
    label: '',
    placeholder,
    value: undefined as unknown as T | T[],
    required,
    readonly: isReadonly,
  } as DbxForgeSearchableChipFieldDef<T, M, H>);

  // SAFE TO REMOVE
  /**
   * - dbxForgeFieldFunctionConfigPropsWithHintBuilder handles this
   *
    props: filterFromPOJO({
      ...chipProps
    }) as DbxForgeSearchableChipFieldProps<T, M, H>
   */
  })
}) as DbxForgeSearchableChipFieldFunction;

/**
 * Creates a forge searchable chip field pre-configured for string values.
 *
 * @param config - String-specific searchable chip field configuration (omits allowStringValues)
 * @returns A {@link DbxForgeFormFieldWrapperFieldDef} wrapping a searchable chip field
 */
export function forgeSearchableStringChipField<M = unknown>(config: DbxForgeSearchableChipFieldConfig<string, M>) {
  return forgeSearchableChipField<string, M>(config);
}
