import { Directive, input } from '@angular/core';
import { ClickableAnchor } from '@dereekb/dbx-core';
import { ArrayOrValue, Maybe, Modifier } from '@dereekb/util';
import { map, Observable } from 'rxjs';
import { DbxValueListItem } from '../../../layout/list/list.view.value';
import { AbstractDbxValueListItemModifierDirective } from '../../../layout/list/list.view.value.modifier.directive';
import { toObservable } from '@angular/core/rxjs-interop';

export type AnchorForValueFunction<T> = (value: T, item: DbxValueListItem<T>) => Maybe<ClickableAnchor>;

export const DBX_ROUTER_VALUE_LIST_ITEM_MODIFIER_KEY = 'router_anchor';

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
