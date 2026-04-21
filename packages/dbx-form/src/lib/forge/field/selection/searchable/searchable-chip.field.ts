import { type PrimativeKey } from '@dereekb/util';
import { configureDbxForgeFormFieldWrapper } from '../../wrapper/formfield/formfield.wrapper';
import { DBX_FORGE_SEARCHABLE_CHIP_FIELD_TYPE_NAME, type DbxForgeSearchableChipFieldDef } from './searchable.field';
import { type DbxForgeFieldFunctionDef, dbxForgeFieldFunction, dbxForgeFieldFunctionConfigPropsWithHintBuilder, dbxForgeBuildFieldDef } from '../../field';
import type { DbxForgeField } from '../../../form/forge.form';

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
 * const field = dbxForgeSearchableChipField({
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
export const dbxForgeSearchableChipField = dbxForgeFieldFunction<DbxForgeSearchableChipFieldConfig>({
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
export function dbxForgeSearchableStringChipField<M = unknown>(config: DbxForgeSearchableChipFieldConfig<string, M>) {
  return dbxForgeSearchableChipField<string, M>(config);
}
