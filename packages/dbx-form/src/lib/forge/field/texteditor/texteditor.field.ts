import { filterFromPOJO } from '@dereekb/util';
import { FORGE_TEXT_EDITOR_FIELD_TYPE, type DbxForgeTextEditorFieldDef } from './texteditor.field.component';
import { dbxForgeFieldFunction, dbxForgeFieldFunctionConfigPropsWithHintBuilder, type DbxForgeFieldFunctionDef, type DbxForgeFieldFunction } from '../field';

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
 * const field = dbxForgeTextEditorField({ key: 'bio', label: 'Biography', maxLength: 2000 });
 * ```
 */
export const dbxForgeTextEditorField = dbxForgeFieldFunction<DbxForgeTextEditorFieldConfig>({
  type: FORGE_TEXT_EDITOR_FIELD_TYPE,
  buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder((config) =>
    filterFromPOJO({
      minLength: config.minLength,
      maxLength: config.maxLength
    })
  )
}) as DbxForgeFieldFunction<DbxForgeTextEditorFieldConfig, DbxForgeTextEditorFieldDef>;
