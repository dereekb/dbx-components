import { type PrimativeKey, type ReadKeyFunction } from '@dereekb/util';
import { type ListLoadingState } from '@dereekb/rxjs';
import { type AbstractDbxSelectionListWrapperDirective } from '@dereekb/dbx-web';
import { type Observable } from 'rxjs';
import { type Type } from '@angular/core';
import type { FieldTypeDefinition, BaseValueField } from '@ng-forge/dynamic-forms';
import { valueFieldMapper } from '@ng-forge/dynamic-forms/integration';
import { dbxForgeMaterialFormFieldWrappedFieldFunction, type DbxForgeFormFieldWrapperWrappedFieldDef } from '../../wrapper/formfield/formfield.wrapper';
import { type DbxForgeFieldFunctionDef, dbxForgeFieldFunctionConfigPropsWithHintBuilder, dbxForgeBuildFieldDef } from '../../field';

// MARK: Field Type Name
/**
 * The custom forge field type name for the list selection field.
 */
export const FORGE_LIST_SELECTION_FIELD_TYPE = 'dbx-list-selection' as const;

// MARK: Props
/**
 * Props interface for the forge list selection field.
 *
 * Passed via the `props` property on the forge field definition.
 */
export interface DbxForgeListSelectionFieldProps<T = unknown, C extends AbstractDbxSelectionListWrapperDirective<T> = AbstractDbxSelectionListWrapperDirective<T>, K extends PrimativeKey = PrimativeKey> {
  /**
   * List component class to render items from. Can be provided as an Observable for lazy loading.
   */
  readonly listComponentClass: Observable<Type<C>>;
  /**
   * Read key function to extract the identifier from each item.
   */
  readonly readKey: ReadKeyFunction<T, K>;
  /**
   * Observable that provides the items to select.
   */
  readonly state$: Observable<ListLoadingState<T>>;
  /**
   * Function that signals to load more items.
   */
  readonly loadMore?: () => void;
  /**
   * Hint text shown below the field.
   */
  readonly hint?: string;
}

// MARK: Field Def
/**
 * Forge field definition interface for the list selection field.
 */
export interface DbxForgeListSelectionFieldDef<T = unknown, C extends AbstractDbxSelectionListWrapperDirective<T> = AbstractDbxSelectionListWrapperDirective<T>, K extends PrimativeKey = PrimativeKey> extends BaseValueField<DbxForgeListSelectionFieldProps<T, C, K>, K[]> {
  readonly type: typeof FORGE_LIST_SELECTION_FIELD_TYPE;
}

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
 * @returns A {@link DbxForgeFormFieldWrapperWrappedFieldDef} wrapping a list selection field
 *
 * @example
 * ```typescript
 * const field = forgeListSelectionField({
 *   key: 'selectedItems',
 *   label: 'Items',
 *   props: {
 *     listComponentClass: of(MyListComponent),
 *     readKey: (item) => item.id,
 *     state$: items$
 *   }
 * });
 * ```
 */
export const forgeListSelectionField = dbxForgeMaterialFormFieldWrappedFieldFunction<DbxForgeListSelectionFieldConfig>({
  type: FORGE_LIST_SELECTION_FIELD_TYPE,
  buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder(),
  buildFieldDef: dbxForgeBuildFieldDef(() => {})
}) as DbxForgeListSelectionFieldFunction;
