import { Directive, input, OnDestroy } from '@angular/core';
import { Maybe, ArrayOrValue, Modifier } from '@dereekb/util';
import { Observable, map } from 'rxjs';
import { DbxValueListItem, DbxValueListItemDecisionFunction } from '../list.view.value';
import { toObservable } from '@angular/core/rxjs-interop';
import { AbstractDbxValueListItemModifierDirective } from './list.view.value.modifier.directive';

export const DBX_LIST_ITEM_DISABLE_RIPPLE_LIST_ITEM_MODIFIER_KEY = 'disable_ripple_anchor';

export const DBX_LIST_ITEM_DEFAULT_DISABLE_FUNCTION: DbxValueListItemDecisionFunction<unknown> = <T>(item: DbxValueListItem<T>) => {
  return item.rippleDisabled || !item.anchor || (!item.anchor.ref && !item.anchor.url && !item.anchor.onClick);
};

@Directive({
  selector: 'dbxListItemDisableRippleModifier,[dbxListItemDisableRippleModifier]',
  standalone: true
})
export class DbxListItemDisableRippleModifierDirective<T> extends AbstractDbxValueListItemModifierDirective<T> implements OnDestroy {
  readonly disableRippleForItem = input<Maybe<DbxValueListItemDecisionFunction<T>>, Maybe<string | DbxValueListItemDecisionFunction<T>>>(undefined, { alias: 'dbxListItemDisableRippleModifier', transform: (x) => (typeof x !== 'string' ? x : undefined) });

  readonly disableRippleForItemModifiers$: Observable<Maybe<ArrayOrValue<Modifier<DbxValueListItem<T>>>>> = toObservable(this.disableRippleForItem).pipe(
    map((x) => x ?? DBX_LIST_ITEM_DEFAULT_DISABLE_FUNCTION),
    map((disableRippleForItem) => {
      const modifiers: Modifier<DbxValueListItem<T>> = {
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

  constructor() {
    super();
    this.setModifiers(this.disableRippleForItemModifiers$);
  }
}
