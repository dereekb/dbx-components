import { Directive, input } from '@angular/core';
import { type ClickableAnchor } from '@dereekb/dbx-core';
import { type ArrayOrValue, type Maybe, type Modifier } from '@dereekb/util';
import { map, type Observable } from 'rxjs';
import { type DbxValueListItem } from '../../../layout/list/list.view.value';
import { AbstractDbxValueListItemModifierDirective } from '../../../layout/list/modifier/list.view.value.modifier.directive';
import { toObservable } from '@angular/core/rxjs-interop';

/**
 * Function that produces a {@link ClickableAnchor} for a given list item value, enabling per-item navigation links.
 */
export type AnchorForValueFunction<T> = (value: T, item: DbxValueListItem<T>) => Maybe<ClickableAnchor>;

/**
 * Modifier key used to identify the router anchor modifier on list items.
 */
export const DBX_ROUTER_VALUE_LIST_ITEM_MODIFIER_KEY = 'router_anchor';

/**
 * Structural directive that attaches a {@link ClickableAnchor} to each item in a {@link DbxValueListView} using a provided mapping function.
 *
 * This enables navigation when clicking list items without modifying the list component itself.
 *
 * @example
 * ```html
 * <dbx-list-view [dbxListItemAnchorModifier]="anchorForItem">
 *   ...
 * </dbx-list-view>
 * ```
 *
 * ```typescript
 * anchorForItem: AnchorForValueFunction<MyItem> = (value) => ({ ref: `/items/${value.id}` });
 * ```
 */
@Directive({
  selector: '[dbxListItemAnchorModifier]',
  standalone: true
})
export class DbxListItemAnchorModifierDirective<T> extends AbstractDbxValueListItemModifierDirective<T> {
  readonly anchorForItem = input<Maybe<AnchorForValueFunction<T>>>(undefined, { alias: 'dbxListItemAnchorModifier' });

  readonly anchorForItemModifiers$: Observable<Maybe<ArrayOrValue<Modifier<DbxValueListItem<T>>>>> = toObservable(this.anchorForItem).pipe(
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

  constructor() {
    super();
    this.setModifiers(this.anchorForItemModifiers$);
  }
}
