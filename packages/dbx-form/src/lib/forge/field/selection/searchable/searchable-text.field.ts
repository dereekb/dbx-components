import { type PrimativeKey } from '@dereekb/util';
import { configureDbxForgeFormFieldWrapper } from '../../wrapper/formfield/formfield.wrapper';
import { DBX_FORGE_SEARCHABLE_TEXT_FIELD_TYPE_NAME, type DbxForgeSearchableTextFieldDef } from './searchable.field';
import { type DbxForgeFieldFunctionDef, dbxForgeFieldFunction, dbxForgeFieldFunctionConfigPropsWithHintBuilder, dbxForgeBuildFieldDef } from '../../field';
import type { DbxForgeField } from '../../../form/forge.form';

// MARK: Searchable Text Field
/**
 * Configuration for a forge searchable text field (single-value autocomplete).
 */
export interface DbxForgeSearchableTextFieldConfig<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends DbxForgeFieldFunctionDef<DbxForgeSearchableTextFieldDef<T, M, H>> {}

export type DbxForgeSearchableTextFieldFunction = <T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey>(config: DbxForgeSearchableTextFieldConfig<T, M, H>) => DbxForgeField<DbxForgeSearchableTextFieldDef<T, M, H>>;

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
 *   props: {
 *     search: (text) => mySearchService.search(text),
 *     displayForValue: (values) => of(values.map(v => ({ ...v, label: v.meta?.name ?? '' })))
 *   }
 * });
 * ```
 */
export const forgeSearchableTextField = dbxForgeFieldFunction<DbxForgeSearchableTextFieldConfig>({
  type: DBX_FORGE_SEARCHABLE_TEXT_FIELD_TYPE_NAME,
  buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder(),
  buildFieldDef: dbxForgeBuildFieldDef((x) => {
    // configure form field wrapper
    x.configure(configureDbxForgeFormFieldWrapper);
  })
}) as DbxForgeSearchableTextFieldFunction;
