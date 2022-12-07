import { Directive, Input, OnDestroy } from '@angular/core';
import { Maybe, ArrayOrValue, Modifier } from '@dereekb/util';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { DbxValueListItem, DbxValueListItemDecisionFunction } from './list.view.value';
import { AbstractDbxValueListItemModifierDirective } from './list.view.value.modifier.directive';

export const DBX_LIST_ITEM_IS_SELECTED_ITEM_MODIFIER_KEY = 'is_selected_item_modifier';

export const DEFAULT_DBX_LIST_ITEM_IS_SELECTED_FUNCTION: DbxValueListItemDecisionFunction<unknown> = <T>(item: DbxValueListItem<T>) => {
  return item.selected ?? false;
};

@Directive({
  selector: '[dbxListItemIsSelectedModifier]'
})
export class DbxListItemIsSelectedModifierDirective<T> extends AbstractDbxValueListItemModifierDirective<T> implements OnDestroy {
  private _listItemIsSelected = new BehaviorSubject<DbxValueListItemDecisionFunction<T>>(DEFAULT_DBX_LIST_ITEM_IS_SELECTED_FUNCTION);

  readonly modifiers$: Observable<Maybe<ArrayOrValue<Modifier<DbxValueListItem<T>>>>> = this._listItemIsSelected.pipe(
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

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._listItemIsSelected.complete();
  }

  @Input('dbxListItemIsSelectedModifier')
  set listItemIsSelected(listItemIsSelected: Maybe<DbxValueListItemDecisionFunction<T>>) {
    this._listItemIsSelected.next(listItemIsSelected ?? DEFAULT_DBX_LIST_ITEM_IS_SELECTED_FUNCTION);
  }
}
