import { type PrimativeKey } from '@dereekb/util';
import { configureDbxForgeFormFieldWrapper } from '../../wrapper/formfield/formfield.wrapper';
import { FORGE_PICKABLE_CHIP_FIELD_TYPE, type DbxForgePickableChipFieldDef } from './pickable.field';
import { type DbxForgeFieldFunctionDef, dbxForgeFieldFunction, dbxForgeFieldFunctionConfigPropsWithHintBuilder, dbxForgeBuildFieldDef } from '../../field';
import type { DbxForgeField } from '../../../form/forge.form';

// MARK: Pickable Chip Field
/**
 * Configuration for a forge pickable chip field.
 */
export interface DbxForgePickableChipFieldConfig<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends DbxForgeFieldFunctionDef<DbxForgePickableChipFieldDef<T, M, H>> {}

export type DbxForgePickableChipFieldFunction = <T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey>(config: DbxForgePickableChipFieldConfig<T, M, H>) => DbxForgeField<DbxForgePickableChipFieldDef<T, M, H>>;

/**
 * Selection field rendering selected values as Material chips. Defaults to multi-select; flip to single-select via the underlying props.
 *
 * @param config - Pickable chip field configuration
 * @returns A {@link DbxForgeFormFieldWrapperFieldDef} wrapping a pickable chip field
 *
 * @dbxFormField
 * @dbxFormSlug pickable-chip
 * @dbxFormTier field-factory
 * @dbxFormProduces T | T[]
 * @dbxFormArrayOutput optional
 * @dbxFormNgFormType dbx-pickable-chip
 * @dbxFormWrapperPattern material-form-field-wrapped
 * @dbxFormConfigInterface DbxForgePickableChipFieldConfig<T, M, H>
 * @dbxFormPropsInterface DbxForgePickableFieldProps
 * @dbxFormGeneric <T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey>
 *
 * @example
 * ```typescript
 * dbxForgePickableChipField<Tag>({ key: 'tags', label: 'Tags', props: { loadValues: () => loadTags$, displayForValue: displayTag } })
 * ```
 */
export const dbxForgePickableChipField = dbxForgeFieldFunction<DbxForgePickableChipFieldConfig>({
  type: FORGE_PICKABLE_CHIP_FIELD_TYPE,
  buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder(),
  buildFieldDef: dbxForgeBuildFieldDef((x) => {
    // configure form field wrapper
    x.configure(configureDbxForgeFormFieldWrapper);
  })
}) as DbxForgePickableChipFieldFunction;
