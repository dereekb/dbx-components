import { type PrimativeKey } from '@dereekb/util';
import type { FieldTypeDefinition } from '@ng-forge/dynamic-forms';
import { valueFieldMapper } from '@ng-forge/dynamic-forms/integration';
import { dbxForgeMaterialFormFieldWrappedFieldFunction, type DbxForgeFormFieldWrapperWrappedFieldDef } from '../../wrapper/formfield/formfield.wrapper';
import { FORGE_SEARCHABLE_TEXT_FIELD_TYPE, type DbxForgeSearchableTextFieldDef } from './searchable.field';
import { type DbxForgeFieldFunctionDef, dbxForgeFieldFunctionConfigPropsWithHintBuilder, dbxForgeBuildFieldDef } from '../../field';

// MARK: Field Type Definition
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

// MARK: Searchable Text Field
/**
 * Configuration for a forge searchable text field (single-value autocomplete).
 */
export interface DbxForgeSearchableTextFieldConfig<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends DbxForgeFieldFunctionDef<DbxForgeSearchableTextFieldDef<T, M, H>> {}

export type DbxForgeSearchableTextFieldFunction = <T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey>(config: DbxForgeSearchableTextFieldConfig<T, M, H>) => DbxForgeFormFieldWrapperWrappedFieldDef<DbxForgeSearchableTextFieldDef<T, M, H>>;

/**
 * Creates a forge field definition for a searchable text field with autocomplete.
 *
 * @param config - Searchable text field configuration
 * @returns A {@link DbxForgeFormFieldWrapperWrappedFieldDef} wrapping a searchable text field
 *
 * @example
 * ```typescript
 * const field = forgeSearchableTextField({
 *   key: 'assignee',
 *   label: 'Assignee',
 *   props: {
 *     search: (text) => mySearchService.search(text),
 *     displayForValue: (values) => of(values.map(v => ({ ...v, label: v.meta?.name ?? '' })))
 *   }
 * });
 * ```
 */
export const forgeSearchableTextField = dbxForgeMaterialFormFieldWrappedFieldFunction<DbxForgeSearchableTextFieldConfig>({
  type: FORGE_SEARCHABLE_TEXT_FIELD_TYPE,
  buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder(),
  buildFieldDef: dbxForgeBuildFieldDef(() => {})
}) as DbxForgeSearchableTextFieldFunction;
