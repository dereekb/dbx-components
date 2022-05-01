import { Directive, Input, OnDestroy } from "@angular/core";
import { ClickableAnchor } from "@dereekb/dbx-core";
import { ArrayOrValue, Maybe, Modifier } from "@dereekb/util";
import { BehaviorSubject, map, Observable } from "rxjs";
import { DbxValueListItem } from "../../../layout/list/list.view.value";
import { AbstractDbxValueListItemModifierDirective } from "../../../layout/list/list.view.value.modifier.directive";

export type AnchorForValueFunction<T> = (value: T, item: DbxValueListItem<T>) => Maybe<ClickableAnchor>;

export const DBX_ROUTER_VALUE_LIST_ITEM_MODIFIER_KEY = 'router_anchor';

@Directive({
  selector: '[dbxListItemAnchorModifier]'
})
export class DbxListItemAnchorModifierDirective<T> extends AbstractDbxValueListItemModifierDirective<T> implements OnDestroy {

  private _anchorForItem = new BehaviorSubject<Maybe<AnchorForValueFunction<T>>>(undefined);

  readonly modifiers$: Observable<Maybe<ArrayOrValue<Modifier<DbxValueListItem<T>>>>> = this._anchorForItem.pipe(
    map((anchorForItem) => {
      let modifiers: Maybe<Modifier<DbxValueListItem<T>>>;

      if (anchorForItem) {
        modifiers = {
          key: DBX_ROUTER_VALUE_LIST_ITEM_MODIFIER_KEY,
          modify: (x: DbxValueListItem<T>) => {
            x.anchor = anchorForItem(x.itemValue, x);
          }
        };
      }

      return modifiers;
    })
  );

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._anchorForItem.complete();
  }

  @Input('dbxListItemAnchorModifier')
  set anchorForItem(anchorForItem: Maybe<AnchorForValueFunction<T>>) {
    this._anchorForItem.next(anchorForItem);
  }

}
