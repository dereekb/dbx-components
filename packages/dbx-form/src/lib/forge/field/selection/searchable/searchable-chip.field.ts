import { type PrimativeKey } from '@dereekb/util';
import type { FieldTypeDefinition } from '@ng-forge/dynamic-forms';
import { valueFieldMapper } from '@ng-forge/dynamic-forms/integration';
import { configureDbxForgeFormFieldWrapper } from '../../wrapper/formfield/formfield.wrapper';
import { DBX_FORGE_SEARCHABLE_CHIP_FIELD_TYPE_NAME, type DbxForgeSearchableChipFieldDef } from './searchable.field';
import { type DbxForgeFieldFunctionDef, dbxForgeFieldFunction, dbxForgeFieldFunctionConfigPropsWithHintBuilder, dbxForgeBuildFieldDef } from '../../field';
import type { DbxForgeField } from '../../../form/forge.form';

// MARK: Field Type Definition
/**
 * ng-forge FieldTypeDefinition for the searchable chip field.
 *
 * Register via `provideDynamicForm(DBX_SEARCHABLE_CHIP_FIELD_TYPE)`.
 */
export const DBX_SEARCHABLE_CHIP_FIELD_TYPE: FieldTypeDefinition<DbxForgeSearchableChipFieldDef> = {
  name: DBX_FORGE_SEARCHABLE_CHIP_FIELD_TYPE_NAME,
  loadComponent: () => import('./searchable-chip.field.component').then((m) => m.DbxForgeSearchableChipFieldComponent),
  mapper: valueFieldMapper
};

// MARK: Searchable Chip Field
/**
 * Configuration for a forge searchable chip field (multi-value autocomplete with chips).
 */
export interface DbxForgeSearchableChipFieldConfig<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends DbxForgeFieldFunctionDef<DbxForgeSearchableChipFieldDef<T, M, H>> {}

export type DbxForgeSearchableChipFieldFunction = <T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey>(config: DbxForgeSearchableChipFieldConfig<T, M, H>) => DbxForgeField<DbxForgeSearchableChipFieldDef<T, M, H>>;

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
 *   props: {
 *     search: (text) => tagService.search(text),
 *     displayForValue: (values) => of(values.map(v => ({ ...v, label: v.meta?.name ?? '' }))),
 *     allowStringValues: true
 *   }
 * });
 * ```
 */
export const forgeSearchableChipField = dbxForgeFieldFunction<DbxForgeSearchableChipFieldConfig>({
  type: DBX_FORGE_SEARCHABLE_CHIP_FIELD_TYPE_NAME,
  buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder(),
  buildFieldDef: dbxForgeBuildFieldDef((x) => {
    // configure form field wrapper
    x.configure(configureDbxForgeFormFieldWrapper);
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
