import { type PrimativeKey, filterFromPOJO } from '@dereekb/util';
import type { FieldDef, FieldTypeDefinition } from '@ng-forge/dynamic-forms';
import { valueFieldMapper } from '@ng-forge/dynamic-forms/integration';
import { type AbstractDbxSelectionListWrapperDirective } from '@dereekb/dbx-web';
import { forgeField } from '../../field';
import { forgeFormFieldWrapper, type ForgeFormFieldWrapperFieldDef } from '../../wrapper/formfield/formfield.field';
import { type ForgeListSelectionFieldProps, type ForgeListSelectionFieldDef } from './list.field.component';

// MARK: Field Type Definition
/**
 * ng-forge FieldTypeDefinition for the list selection field.
 *
 * Register via `provideDynamicForm(DBX_LIST_SELECTION_FIELD_TYPE)`.
 */
export const DBX_LIST_SELECTION_FIELD_TYPE: FieldTypeDefinition<ForgeListSelectionFieldDef> = {
  name: 'dbx-list-selection',
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
}

/**
 * Creates a forge field definition for a list selection field.
 *
 * @param config - List selection field configuration
 * @returns A validated {@link ForgeListSelectionFieldDef}
 *
 * @example
 * ```typescript
 * const field = forgeListSelectionField({
 *   key: 'selectedItems',
 *   label: 'Items',
 *   listComponentClass: of(MyListComponent),
 *   readKey: (item) => item.id,
 *   state$: items$
 * });
 * ```
 */
export function forgeListSelectionField<T = unknown, C extends AbstractDbxSelectionListWrapperDirective<T> = AbstractDbxSelectionListWrapperDirective<T>, K extends PrimativeKey = PrimativeKey>(config: ForgeListSelectionFieldConfig<T, C, K>): ForgeFormFieldWrapperFieldDef<ForgeListSelectionFieldDef<T, C, K>> {
  const { key, label, required, readonly: isReadonly, description, ...listProps } = config;

  const innerField = forgeField(
    filterFromPOJO({
      key,
      type: 'dbx-list-selection' as const,
      label: '',
      value: undefined as unknown as K[],
      required,
      readonly: isReadonly,
      props: filterFromPOJO({
        ...listProps
      }) as ForgeListSelectionFieldProps<T, C, K>
    }) as ForgeListSelectionFieldDef<T, C, K>
  );

  return forgeFormFieldWrapper<ForgeListSelectionFieldDef<T, C, K>>({
    label: label ?? '',
    hint: description,
    fields: [innerField as unknown as FieldDef<unknown>]
  });
}
