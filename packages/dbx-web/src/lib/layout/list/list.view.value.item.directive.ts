import { Directive, Inject } from "@angular/core";
import { DbxValueListItem, DBX_VALUE_LIST_VIEW_ITEM } from "./list.view.value";

@Directive()
export abstract class AbstractDbxSelectionValueListViewItemComponent<T, I extends DbxValueListItem<T> = DbxValueListItem<T>> {

  get value() {
    return this.item.value;
  }

  constructor(@Inject(DBX_VALUE_LIST_VIEW_ITEM) readonly item: I) { }

}
