import { Directive, inject } from '@angular/core';
import { DbxValueListItem, DBX_VALUE_LIST_VIEW_ITEM } from './list.view.value';

@Directive()
export abstract class AbstractDbxValueListViewItemComponent<T, I extends DbxValueListItem<T> = DbxValueListItem<T>> {
  readonly item = inject<I>(DBX_VALUE_LIST_VIEW_ITEM);

  get itemValue(): T {
    return this.item.itemValue;
  }
}
