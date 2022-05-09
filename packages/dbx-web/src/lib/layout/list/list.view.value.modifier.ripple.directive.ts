import { Directive, Input, OnDestroy } from "@angular/core";
import { Maybe, ArrayOrValue, Modifier } from "@dereekb/util";
import { BehaviorSubject, Observable, map } from "rxjs";
import { DbxValueListItem } from "./list.view.value";
import { AbstractDbxValueListItemModifierDirective } from "./list.view.value.modifier.directive";

export type DisableRippleForValueFunction<T> = (item: DbxValueListItem<T>) => boolean;

export const DBX_LIST_ITEM_DISABLE_RIPPLE_LIST_ITEM_MODIFIER_KEY = 'disable_ripple_anchor';

export const DBX_LIST_ITEM_DEFAULT_DISABLE_FUNCTION: DisableRippleForValueFunction<any> = <T>(item: DbxValueListItem<T>) => {
  return item.rippleDisabled || !item.anchor || (!item.anchor.ref && !item.anchor.url && !item.anchor.onClick);
};

@Directive({
  selector: '[dbxListItemDisableRippleModifier]'
})
export class DbxListItemDisableRippleModifierDirective<T> extends AbstractDbxValueListItemModifierDirective<T> implements OnDestroy {

  private _disableRippleForItem = new BehaviorSubject<DisableRippleForValueFunction<T>>(DBX_LIST_ITEM_DEFAULT_DISABLE_FUNCTION);

  readonly modifiers$: Observable<Maybe<ArrayOrValue<Modifier<DbxValueListItem<T>>>>> = this._disableRippleForItem.pipe(
    map((disableRippleForItem) => {
      let modifiers: Maybe<Modifier<DbxValueListItem<T>>>;

      modifiers = {
        key: DBX_LIST_ITEM_DISABLE_RIPPLE_LIST_ITEM_MODIFIER_KEY,
        modify: (x: DbxValueListItem<T>) => {
          if (disableRippleForItem(x)) {
            x.rippleDisabled = true;
          }
        }
      };

      return modifiers;
    })
  );

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._disableRippleForItem.complete();
  }

  @Input('dbxListItemDisableRippleModifier')
  set disableRippleForItem(disableRippleForItem: Maybe<DisableRippleForValueFunction<T>>) {
    this._disableRippleForItem.next(disableRippleForItem ?? DBX_LIST_ITEM_DEFAULT_DISABLE_FUNCTION);
  }

}
