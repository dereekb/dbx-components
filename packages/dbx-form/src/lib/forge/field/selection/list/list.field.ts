import { type PrimativeKey, filterFromPOJO } from '@dereekb/util';
import type { FieldDef, FieldTypeDefinition } from '@ng-forge/dynamic-forms';
import { valueFieldMapper } from '@ng-forge/dynamic-forms/integration';
import { type AbstractDbxSelectionListWrapperDirective } from '@dereekb/dbx-web';
import { forgeField } from '../../field';
import { forgeFormFieldWrapper, type ForgeFormFieldWrapperFieldDef } from '../../wrapper/formfield/formfield.field';
import { FORGE_LIST_SELECTION_FIELD_TYPE, type ForgeListSelectionFieldProps, type ForgeListSelectionFieldDef } from './list.field.component';

// MARK: Field Type Definition
/**
 * ng-forge FieldTypeDefinition for the list selection field.
 *
 * Register via `provideDynamicForm(DBX_LIST_SELECTION_FIELD_TYPE)`.
 */
export const DBX_LIST_SELECTION_FIELD_TYPE: FieldTypeDefinition<ForgeListSelectionFieldDef> = {
  name: FORGE_LIST_SELECTION_FIELD_TYPE,
  loadComponent: () => import('./list.field.component').then((m) => m.DbxForgeListSelectionFieldComponent),
  mapper: valueFieldMapper
};

// MARK: List Selection Field
/**
 * Configuration for a forge list selection field.
 */
export interface ForgeListSelectionFieldConfig<T = unknown, C extends AbstractDbxSelectionListWrapperDirective<T> = AbstractDbxSelectionListWrapperDirective<T>, K extends PrimativeKey = PrimativeKey> extends ForgeListSelectionFieldProps<T, C, K> {
  readonly key: string;
  readonly label?: string;
  readonly required?: boolean;
  readonly readonly?: boolean;
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
 * @returns A {@link ForgeFormFieldWrapperFieldDef} when wrapped (default), or a raw {@link ForgeListSelectionFieldDef} when `wrapInFormField` is `false`
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
export function forgeListSelectionField<T = unknown, C extends AbstractDbxSelectionListWrapperDirective<T> = AbstractDbxSelectionListWrapperDirective<T>, K extends PrimativeKey = PrimativeKey>(config: ForgeListSelectionFieldConfig<T, C, K>): ForgeFormFieldWrapperFieldDef<ForgeListSelectionFieldDef<T, C, K>> | ForgeListSelectionFieldDef<T, C, K> {
  const { key, label, required, readonly: isReadonly, description, wrapInFormField = true, ...listProps } = config;
  const useWrapper = wrapInFormField !== false;

  const innerField = forgeField(
    filterFromPOJO({
      key,
      type: FORGE_LIST_SELECTION_FIELD_TYPE,
      label: useWrapper ? '' : (label ?? ''),
      value: undefined as unknown as K[],
      required,
      readonly: isReadonly,
      props: filterFromPOJO({
        ...listProps,
        hint: useWrapper ? listProps.hint : (description ?? listProps.hint)
      }) as ForgeListSelectionFieldProps<T, C, K>
    }) as ForgeListSelectionFieldDef<T, C, K>
  );

  if (!useWrapper) {
    return innerField;
  }

  return forgeFormFieldWrapper<ForgeListSelectionFieldDef<T, C, K>>({
    label: label ?? '',
    hint: description,
    fields: [innerField as unknown as FieldDef<unknown>]
  });
}
