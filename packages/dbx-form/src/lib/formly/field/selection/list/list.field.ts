import { FormlyFieldConfig } from '@ngx-formly/core';
import { LabeledFieldConfig, formlyField, propsAndConfigForFieldConfig } from '../../field';
import { DbxItemListFieldProps } from './list.field.component';
import { AbstractDbxSelectionListWrapperDirective } from '@dereekb/dbx-web';
import { PrimativeKey } from '@dereekb/util';

export interface DbxListFieldConfig<T = unknown, C extends AbstractDbxSelectionListWrapperDirective<T> = AbstractDbxSelectionListWrapperDirective<T>, K extends PrimativeKey = PrimativeKey> extends LabeledFieldConfig, DbxItemListFieldProps<T, C, K> {}

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
