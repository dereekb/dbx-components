import { Directive, Inject } from "@angular/core";
import { DbxValueListItem, DBX_VALUE_LIST_VIEW_ITEM } from "./list.view.value";

@Directive()
export abstract class AbstractDbxValueListViewItemComponent<T, I extends DbxValueListItem<T> = DbxValueListItem<T>> {

  get itemValue() {
    return this.item.itemValue;
  }

  constructor(@Inject(DBX_VALUE_LIST_VIEW_ITEM) readonly item: I) { }

}
