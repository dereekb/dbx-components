import { type PrimativeKey } from '@dereekb/util';
import type { FieldTypeDefinition } from '@ng-forge/dynamic-forms';
import { valueFieldMapper } from '@ng-forge/dynamic-forms/integration';
import { type AbstractDbxSelectionListWrapperDirective } from '@dereekb/dbx-web';
import { dbxForgeMaterialFormFieldWrappedFieldFunction, type DbxForgeFormFieldWrapperWrappedFieldDef } from '../../wrapper/formfield/formfield.wrapper';
import { FORGE_LIST_SELECTION_FIELD_TYPE, type DbxForgeListSelectionFieldDef } from './list.field.component';
import { type DbxForgeFieldFunctionDef, dbxForgeFieldFunctionConfigPropsWithHintBuilder, dbxForgeBuildFieldDef } from '../../field';

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
export interface DbxForgeListSelectionFieldConfig<T = unknown, C extends AbstractDbxSelectionListWrapperDirective<T> = AbstractDbxSelectionListWrapperDirective<T>, K extends PrimativeKey = PrimativeKey> extends DbxForgeFieldFunctionDef<DbxForgeListSelectionFieldDef<T, C, K>> {}

export type DbxForgeListSelectionFieldFunction = <T = unknown, C extends AbstractDbxSelectionListWrapperDirective<T> = AbstractDbxSelectionListWrapperDirective<T>, K extends PrimativeKey = PrimativeKey>(config: DbxForgeListSelectionFieldConfig<T, C, K>) => DbxForgeFormFieldWrapperWrappedFieldDef<DbxForgeListSelectionFieldDef<T, C, K>>;

/**
 * Creates a forge field definition for a list selection field.
 *
 * @param config - List selection field configuration
 * @returns A {@link DbxForgeFormFieldWrapperWrappedFieldDef} when wrapped (default), or a raw {@link DbxForgeListSelectionFieldDef} when `wrapInFormField` is `false`
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
export const forgeListSelectionField = dbxForgeMaterialFormFieldWrappedFieldFunction<DbxForgeListSelectionFieldConfig>({
  type: FORGE_LIST_SELECTION_FIELD_TYPE,
  buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder(),
  buildFieldDef: () => {
    // TODO: Ensure proper merging
    /*

  const innerField = forgeField({
    key,
    type: FORGE_LIST_SELECTION_FIELD_TYPE,
    label: useWrapper ? '' : (label ?? ''),
    value: undefined as unknown as K[],
    required,
    readonly: isReadonly,
    logic: useWrapper ? undefined : logic,
  } as DbxForgeListSelectionFieldDef<T, C, K>);

  // SAFE TO REMOVE
  /**
   * - dbxForgeFieldFunctionConfigPropsWithHintBuilder handles this
   * 
    props: filterFromPOJO({
      ...listProps,
      hint: useWrapper ? listProps.hint : (description ?? listProps.hint)
    }) as DbxForgeListSelectionFieldProps<T, C, K>
   */
  }
}) as DbxForgeListSelectionFieldFunction;
