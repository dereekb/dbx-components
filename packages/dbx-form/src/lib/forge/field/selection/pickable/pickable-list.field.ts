import { type PrimativeKey } from '@dereekb/util';
import { configureDbxForgeFormFieldWrapper } from '../../wrapper/formfield/formfield.wrapper';
import { FORGE_PICKABLE_LIST_FIELD_TYPE, type DbxForgePickableListFieldDef } from './pickable.field';
import { type DbxForgeFieldFunctionDef, dbxForgeFieldFunction, dbxForgeFieldFunctionConfigPropsWithHintBuilder, dbxForgeBuildFieldDef } from '../../field';
import type { DbxForgeField } from '../../../form/forge.form';

// MARK: Pickable List Field
/**
 * Configuration for a forge pickable list field.
 */
export interface DbxForgePickableListFieldConfig<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends DbxForgeFieldFunctionDef<DbxForgePickableListFieldDef<T, M, H>> {}

export type DbxForgePickableListFieldFunction = <T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey>(config: DbxForgePickableListFieldConfig<T, M, H>) => DbxForgeField<DbxForgePickableListFieldDef<T, M, H>>;

/**
 * Scrollable-list variant of `pickable-chip` — same API, different presentation. Prefer this when the option set is large.
 *
 * @param config - Pickable list field configuration
 * @returns A {@link DbxForgeFormFieldWrapperFieldDef} wrapping a pickable list field
 *
 * @dbxFormField
 * @dbxFormSlug pickable-list
 * @dbxFormTier field-factory
 * @dbxFormProduces T | T[]
 * @dbxFormArrayOutput optional
 * @dbxFormNgFormType dbx-pickable-list
 * @dbxFormWrapperPattern material-form-field-wrapped
 * @dbxFormConfigInterface DbxForgePickableListFieldConfig<T, M, H>
 * @dbxFormPropsInterface DbxForgePickableFieldProps
 * @dbxFormGeneric <T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey>
 *
 * @example
 * ```typescript
 * dbxForgePickableListField<Item>({ key: 'items', props: { loadValues, displayForValue } })
 * ```
 */
export const dbxForgePickableListField = dbxForgeFieldFunction<DbxForgePickableListFieldConfig>({
  type: FORGE_PICKABLE_LIST_FIELD_TYPE,
  buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder(),
  buildFieldDef: dbxForgeBuildFieldDef((x) => {
    // configure form field wrapper
    x.configure(configureDbxForgeFormFieldWrapper);
  })
}) as DbxForgePickableListFieldFunction;
