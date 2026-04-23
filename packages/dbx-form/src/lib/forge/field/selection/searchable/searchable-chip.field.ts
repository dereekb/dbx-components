import { type PrimativeKey } from '@dereekb/util';
import { type BaseValueField } from '@ng-forge/dynamic-forms';
import { configureDbxForgeFormFieldWrapper } from '../../wrapper/formfield/formfield.wrapper';
import { type DbxForgeSearchableTextFieldProps } from './searchable-text.field';
import { type DbxForgeFieldFunctionDef, dbxForgeFieldFunction, dbxForgeFieldFunctionConfigPropsWithHintBuilder, dbxForgeBuildFieldDef } from '../../field';
import type { DbxForgeField } from '../../../form/forge.form';

// MARK: Field Type Name
/**
 * The custom forge field type name for the searchable chip field.
 */
export const DBX_FORGE_SEARCHABLE_CHIP_FIELD_TYPE_NAME = 'dbx-searchable-chip' as const;

// MARK: Props
/**
 * Props interface for the forge searchable chip field.
 */
export interface DbxForgeSearchableChipFieldProps<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends DbxForgeSearchableTextFieldProps<T, M, H> {
  readonly multiSelect?: boolean;
  readonly asArrayValue?: boolean;
}

// MARK: Field Def
/**
 * Forge field definition interface for the searchable chip field.
 */
export interface DbxForgeSearchableChipFieldDef<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends BaseValueField<DbxForgeSearchableChipFieldProps<T, M, H>, T | T[]> {
  readonly type: typeof DBX_FORGE_SEARCHABLE_CHIP_FIELD_TYPE_NAME;
}

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
