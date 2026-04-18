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
 * Creates a forge field definition for a pickable list field.
 *
 * @param config - Pickable list field configuration
 * @returns A {@link DbxForgeFormFieldWrapperFieldDef} wrapping a pickable list field
 *
 * @example
 * ```typescript
 * const field = forgePickableListField({
 *   key: 'categories',
 *   label: 'Categories',
 *   loadValues: () => categories$,
 *   displayForValue: (values) => of(values.map(v => ({ ...v, label: v.meta?.label ?? '' }))),
 *   hashForValue: (cat) => cat.id
 * });
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

// MARK: Deprecated
/** @deprecated Use {@link dbxForgePickableListField} instead. */
export const forgePickableListField = dbxForgePickableListField;
