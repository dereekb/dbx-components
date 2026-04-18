import { type PrimativeKey } from '@dereekb/util';
import type { FieldTypeDefinition } from '@ng-forge/dynamic-forms';
import { valueFieldMapper } from '@ng-forge/dynamic-forms/integration';
import { configureDbxForgeFormFieldWrapper } from '../../wrapper/formfield/formfield.wrapper';
import { FORGE_PICKABLE_LIST_FIELD_TYPE, type DbxForgePickableListFieldDef } from './pickable.field';
import { type DbxForgeFieldFunctionDef, dbxForgeFieldFunction, dbxForgeFieldFunctionConfigPropsWithHintBuilder, dbxForgeBuildFieldDef } from '../../field';
import type { DbxForgeField } from '../../../form/forge.form';

// MARK: Field Type Definition
/**
 * ng-forge FieldTypeDefinition for the pickable list field.
 *
 * Register via `provideDynamicForm(DBX_PICKABLE_LIST_FIELD_TYPE)`.
 */
export const DBX_PICKABLE_LIST_FIELD_TYPE: FieldTypeDefinition<DbxForgePickableListFieldDef> = {
  name: FORGE_PICKABLE_LIST_FIELD_TYPE,
  loadComponent: () => import('./pickable-list.field.component').then((m) => m.DbxForgePickableListFieldComponent),
  mapper: valueFieldMapper
};

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
export const forgePickableListField = dbxForgeFieldFunction<DbxForgePickableListFieldConfig>({
  type: FORGE_PICKABLE_LIST_FIELD_TYPE,
  buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder(),
  buildFieldDef: dbxForgeBuildFieldDef((x) => {
    // configure form field wrapper
    x.configure(configureDbxForgeFormFieldWrapper);
  })
}) as DbxForgePickableListFieldFunction;
