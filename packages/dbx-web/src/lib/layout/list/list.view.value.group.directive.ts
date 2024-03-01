import { OnDestroy, Directive } from '@angular/core';
import { DbxValueListItem, DbxValueListView } from './list.view.value';
import { DbxValueListViewGroupDelegate, DbxValueListViewGroupValuesFunction } from './list.view.value.group';

/**
 * Delegate used to for grouping DbxValueListItemConfig<T, I> values.
 */
@Directive({
  selector: '[dbxListGroupDelegate]'
})
export class DbxValueListViewGroupDelegateDirective<T, I extends DbxValueListItem<T> = DbxValueListItem<T>> implements DbxValueListViewGroupDelegate<unknown, T, I> {
  readonly groupValues: DbxValueListViewGroupValuesFunction<unknown, T, I, unknown, unknown> = () => {
    return [];
  };
}
