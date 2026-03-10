import { Directive, input } from '@angular/core';
import { type Maybe, type ArrayOrValue, type Modifier } from '@dereekb/util';
import { type Observable, map } from 'rxjs';
import { type DbxValueListItem, type DbxValueListItemDecisionFunction } from '../list.view.value';
import { toObservable } from '@angular/core/rxjs-interop';
import { AbstractDbxValueListItemModifierDirective } from './list.view.value.modifier.directive';
import { transformEmptyStringInputToUndefined } from '@dereekb/dbx-core';

/**
 * Modifier key used to identify the ripple-disable modifier in the modifier map.
 */
export const DBX_LIST_ITEM_DISABLE_RIPPLE_LIST_ITEM_MODIFIER_KEY = 'disable_ripple_anchor';

/**
 * Default decision function that disables ripple on items that already have ripple disabled,
 * lack an anchor, or have an anchor with no navigation target.
 */
export const DBX_LIST_ITEM_DEFAULT_DISABLE_FUNCTION: DbxValueListItemDecisionFunction<unknown> = <T>(item: DbxValueListItem<T>) => {
  return item.rippleDisabled || !item.anchor || (!item.anchor.ref && !item.anchor.url && !item.anchor.onClick);
};

/**
 * Modifier directive that disables the Material ripple effect on list items based on a decision function.
 * By default, disables ripple on items without meaningful anchor navigation targets.
 *
 * @example
 * ```html
 * <dbx-list-view dbxListItemDisableRippleModifier [config]="listViewConfig"></dbx-list-view>
 * ```
 */
@Directive({
  selector: 'dbxListItemDisableRippleModifier,[dbxListItemDisableRippleModifier]',
  standalone: true
})
export class DbxListItemDisableRippleModifierDirective<T> extends AbstractDbxValueListItemModifierDirective<T> {
  readonly disableRippleForItem = input<Maybe<DbxValueListItemDecisionFunction<T>>, Maybe<'' | DbxValueListItemDecisionFunction<T>>>(undefined, { alias: 'dbxListItemDisableRippleModifier', transform: transformEmptyStringInputToUndefined });

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
