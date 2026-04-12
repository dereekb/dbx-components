import { type PrimativeKey, filterFromPOJO } from '@dereekb/util';
import type { FieldDef, FieldTypeDefinition } from '@ng-forge/dynamic-forms';
import { valueFieldMapper } from '@ng-forge/dynamic-forms/integration';
import { type AbstractDbxSelectionListWrapperDirective } from '@dereekb/dbx-web';
import { forgeField } from '../../field.util.meta';
import { forgeFormFieldWrapper, type DbxForgeFormFieldWrapperFieldDef } from '../../wrapper/formfield/formfield.field';
import { FORGE_LIST_SELECTION_FIELD_TYPE, type DbxForgeListSelectionFieldProps, type DbxForgeListSelectionFieldDef } from './list.field.component';
import type { DbxForgeFieldConfig } from '../../field.type';

// MARK: Field Type Definition
/**
 * ng-forge FieldTypeDefinition for the list selection field.
 *
 * Register via `provideDynamicForm(DBX_LIST_SELECTION_FIELD_TYPE)`.
 */
export const DBX_LIST_SELECTION_FIELD_TYPE: FieldTypeDefinition<DbxForgeListSelectionFieldDef> = {
  name: FORGE_LIST_SELECTION_FIELD_TYPE,
  loadComponent: () => import('./list.field.component').then((m) => m.DbxForgeListSelectionFieldComponent),
  mapper: valueFieldMapper
};

// MARK: List Selection Field
/**
 * Configuration for a forge list selection field.
 */
export interface DbxForgeListSelectionFieldConfig<T = unknown, C extends AbstractDbxSelectionListWrapperDirective<T> = AbstractDbxSelectionListWrapperDirective<T>, K extends PrimativeKey = PrimativeKey> extends DbxForgeFieldConfig, DbxForgeListSelectionFieldProps<T, C, K> {
  readonly label?: string;
  readonly description?: string;
  /**
   * Whether to wrap this field in the Material-style outlined form-field wrapper.
   *
   * When `true`, the field is wrapped in `forgeFormFieldWrapper()` which provides a notched
   * outline with floating label and hint/error subscript. When `false`, the field renders
   * with its own built-in label and description.
   *
   * Defaults to `true`.
   */
  readonly wrapInFormField?: boolean;
}

/**
 * Creates a forge field definition for a list selection field.
 *
 * @param config - List selection field configuration
 * @returns A {@link DbxForgeFormFieldWrapperFieldDef} when wrapped (default), or a raw {@link DbxForgeListSelectionFieldDef} when `wrapInFormField` is `false`
 *
 * @example
 * ```typescript
 * // With form-field wrapper (default)
 * const field = forgeListSelectionField({
 *   key: 'selectedItems',
 *   label: 'Items',
 *   listComponentClass: of(MyListComponent),
 *   readKey: (item) => item.id,
 *   state$: items$
 * });
 *
 * // Without form-field wrapper
 * const unwrapped = forgeListSelectionField({
 *   key: 'selectedItems',
 *   label: 'Items',
 *   wrapInFormField: false,
 *   listComponentClass: of(MyListComponent),
 *   readKey: (item) => item.id,
 *   state$: items$
 * });
 * ```
 */
export function forgeListSelectionField<T = unknown, C extends AbstractDbxSelectionListWrapperDirective<T> = AbstractDbxSelectionListWrapperDirective<T>, K extends PrimativeKey = PrimativeKey>(config: DbxForgeListSelectionFieldConfig<T, C, K>): DbxForgeFormFieldWrapperFieldDef<DbxForgeListSelectionFieldDef<T, C, K>> | DbxForgeListSelectionFieldDef<T, C, K> {
  const { key, label, required, readonly: isReadonly, description, wrapInFormField = true, logic, ...listProps } = config;
  const useWrapper = wrapInFormField !== false;

  const innerField = forgeField({
    key,
    type: FORGE_LIST_SELECTION_FIELD_TYPE,
    label: useWrapper ? '' : (label ?? ''),
    value: undefined as unknown as K[],
    required,
    readonly: isReadonly,
    logic: useWrapper ? undefined : logic,
    props: filterFromPOJO({
      ...listProps,
      hint: useWrapper ? listProps.hint : (description ?? listProps.hint)
    }) as DbxForgeListSelectionFieldProps<T, C, K>
  } as DbxForgeListSelectionFieldDef<T, C, K>);

  if (!useWrapper) {
    return innerField;
  }

  return forgeFormFieldWrapper<DbxForgeListSelectionFieldDef<T, C, K>>({
    label: label ?? '',
    hint: description,
    logic,
    fields: [innerField as unknown as FieldDef<unknown>]
  });
}
