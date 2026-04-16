import { filterFromPOJO } from '@dereekb/util';
import type { FieldTypeDefinition } from '@ng-forge/dynamic-forms';
import { valueFieldMapper } from '@ng-forge/dynamic-forms/integration';
import { FORGE_TEXT_EDITOR_FIELD_TYPE, type DbxForgeTextEditorFieldDef } from './texteditor.field.component';
import { dbxForgeFieldFunction, dbxForgeFieldFunctionConfigPropsWithHintBuilder, type DbxForgeFieldFunctionDef, type DbxForgeFieldFunction } from '../field';

// MARK: Field Type Definition
/**
 * ng-forge FieldTypeDefinition for the rich text editor field.
 *
 * Register via `provideDynamicForm(DBX_TEXT_EDITOR_FIELD_TYPE)`.
 */
export const DBX_TEXT_EDITOR_FIELD_TYPE: FieldTypeDefinition<DbxForgeTextEditorFieldDef> = {
  name: FORGE_TEXT_EDITOR_FIELD_TYPE,
  loadComponent: () => import('./texteditor.field.component').then((m) => m.DbxForgeTextEditorFieldComponent),
  mapper: valueFieldMapper
};

// MARK: Config
/**
 * Configuration for a forge rich text editor field.
 */
export interface DbxForgeTextEditorFieldConfig extends DbxForgeFieldFunctionDef<DbxForgeTextEditorFieldDef> {}

/**
 * Creates a forge field definition for a rich text editor.
 *
 * Uses ngx-editor under the hood, outputting HTML format.
 * The field defaults to an empty string.
 *
 * @param config - Text editor field configuration
 * @returns A validated {@link DbxForgeTextEditorFieldDef}
 *
 * @example
 * ```typescript
 * const field = forgeTextEditorField({ key: 'bio', label: 'Biography', maxLength: 2000 });
 * ```
 */
export const forgeTextEditorField = dbxForgeFieldFunction<DbxForgeTextEditorFieldConfig>({
  type: FORGE_TEXT_EDITOR_FIELD_TYPE,
  buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder((config) =>
    filterFromPOJO({
      minLength: config.minLength,
      maxLength: config.maxLength
    })
  )
}) as DbxForgeFieldFunction<DbxForgeTextEditorFieldConfig, DbxForgeTextEditorFieldDef>;
