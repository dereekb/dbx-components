import { type FormlyFieldConfig } from '@ngx-formly/core';
import { type LabeledFieldConfig, formlyField, propsAndConfigForFieldConfig } from '../../field';
import { type DbxItemListFieldProps } from './list.field.component';
import { type AbstractDbxSelectionListWrapperDirective } from '@dereekb/dbx-web';
import { type PrimativeKey } from '@dereekb/util';

/**
 * Configuration for a dbx list selection field that displays items in a selection list component.
 */
export interface DbxListFieldConfig<T = unknown, C extends AbstractDbxSelectionListWrapperDirective<T> = AbstractDbxSelectionListWrapperDirective<T>, K extends PrimativeKey = PrimativeKey> extends LabeledFieldConfig, DbxItemListFieldProps<T, C, K> {}

/**
 * Creates a Formly field configuration for a dbx selection list field.
 *
 * @param config - List field configuration including the list component class and state observable
 * @returns A validated {@link FormlyFieldConfig} with type `'dbxlistfield'`
 *
 * @example
 * ```typescript
 * const field = dbxListField({
 *   key: 'selectedItems',
 *   label: 'Items',
 *   listComponentClass: MyListComponent,
 *   state$: items$
 * });
 * ```
 */
export function dbxListField<T = unknown, C extends AbstractDbxSelectionListWrapperDirective<T> = AbstractDbxSelectionListWrapperDirective<T>, K extends PrimativeKey = PrimativeKey>(config: DbxListFieldConfig<T, C, K>): FormlyFieldConfig {
  const { key, listComponentClass, readKey, state$, loadMore } = config;
  return formlyField({
    key,
    type: 'dbxlistfield',
    ...propsAndConfigForFieldConfig(config, {
      listComponentClass,
      readKey,
      state$,
      loadMore
    })
  });
}
