import { filterFromPOJO } from '@dereekb/util';
import type { FieldTypeDefinition } from '@ng-forge/dynamic-forms';
import { valueFieldMapper } from '@ng-forge/dynamic-forms/integration';
import { forgeField } from '../field';
import { FORGE_TEXT_EDITOR_FIELD_TYPE, type DbxForgeTextEditorFieldProps, type DbxForgeTextEditorFieldDef } from './texteditor.field.component';
import type { DbxForgeTextFieldLengthConfig } from '../value/text/text.field';

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
export interface DbxForgeTextEditorFieldConfig extends DbxForgeTextFieldLengthConfig {
  readonly key: string;
  readonly label?: string;
  readonly required?: boolean;
  readonly readonly?: boolean;
  readonly description?: string;
}

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
export function forgeTextEditorField(config: DbxForgeTextEditorFieldConfig): DbxForgeTextEditorFieldDef {
  const { key, label, required, readonly: isReadonly, description, minLength, maxLength } = config;

  return forgeField(
    filterFromPOJO({
      key,
      type: FORGE_TEXT_EDITOR_FIELD_TYPE,
      label: label ?? '',
      value: '' as string,
      required,
      readonly: isReadonly,
      minLength,
      maxLength,
      props: filterFromPOJO({
        minLength,
        maxLength,
        hint: description
      }) as DbxForgeTextEditorFieldProps
    }) as DbxForgeTextEditorFieldDef
  );
}
