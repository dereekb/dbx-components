import { type PrimativeKey } from '@dereekb/util';
import { configureDbxForgeFormFieldWrapper } from '../../wrapper/formfield/formfield.wrapper';
import { DBX_FORGE_SEARCHABLE_CHIP_FIELD_TYPE_NAME, type DbxForgeSearchableChipFieldDef, type DbxForgeSearchableChipFieldProps } from './searchable.field';
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
 * Configuration for a forge searchable string chip field, pre-configured for string values.
 *
 * `allowStringValues` is omitted from the config — it is always forced to `true`
 * so users can type a value and press Enter to add it as a chip.
 */
export type DbxForgeSearchableStringChipFieldConfig<M = unknown> = Omit<DbxForgeSearchableChipFieldConfig<string, M>, 'props'> & {
  readonly props?: Omit<DbxForgeSearchableChipFieldProps<string, M>, 'allowStringValues'>;
};

/**
 * Creates a forge searchable chip field pre-configured for string values.
 *
 * Always sets `allowStringValues: true` on the inner field props so pressing Enter
 * (or typing a separator key) commits the typed value as a chip.
 *
 * @param config - String-specific searchable chip field configuration (omits allowStringValues)
 * @returns A {@link DbxForgeFormFieldWrapperFieldDef} wrapping a searchable chip field
 */
export function dbxForgeSearchableStringChipField<M = unknown>(config: DbxForgeSearchableStringChipFieldConfig<M>) {
  return dbxForgeSearchableChipField<string, M>({
    ...config,
    props: {
      ...(config.props ?? {}),
      allowStringValues: true
    }
  } as DbxForgeSearchableChipFieldConfig<string, M>);
}
