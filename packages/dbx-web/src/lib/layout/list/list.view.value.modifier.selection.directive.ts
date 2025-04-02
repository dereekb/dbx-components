import { Directive, input, Input, OnDestroy } from '@angular/core';
import { Maybe, ArrayOrValue, Modifier } from '@dereekb/util';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { DbxValueListItem, DbxValueListItemDecisionFunction } from './list.view.value';
import { AbstractDbxValueListItemModifierDirective } from './list.view.value.modifier.directive';
import { toObservable } from '@angular/core/rxjs-interop';

export const DBX_LIST_ITEM_IS_SELECTED_ITEM_MODIFIER_KEY = 'is_selected_item_modifier';

export const DEFAULT_DBX_LIST_ITEM_IS_SELECTED_FUNCTION: DbxValueListItemDecisionFunction<unknown> = <T>(item: DbxValueListItem<T>) => {
  return item.selected ?? false;
};

@Directive({
  selector: '[dbxListItemIsSelectedModifier]',
  standalone: true
})
export class DbxListItemIsSelectedModifierDirective<T> extends AbstractDbxValueListItemModifierDirective<T> implements OnDestroy {
  readonly listItemIsSelected = input<Maybe<DbxValueListItemDecisionFunction<T>>>(undefined, {
    alias: 'dbxListItemIsSelectedModifier'
  });

  readonly modifiers$: Observable<Maybe<ArrayOrValue<Modifier<DbxValueListItem<T>>>>> = toObservable(this.listItemIsSelected).pipe(
    map((x) => x ?? DEFAULT_DBX_LIST_ITEM_IS_SELECTED_FUNCTION),
    map((listItemIsSelected) => {
      const modifiers: Modifier<DbxValueListItem<T>> = {
        key: DBX_LIST_ITEM_IS_SELECTED_ITEM_MODIFIER_KEY,
        modify: (x: DbxValueListItem<T>) => {
          x.selected = listItemIsSelected(x);
        }
      };

      return modifiers;
    })
  );
}
