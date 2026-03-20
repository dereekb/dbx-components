import { Directive, input } from '@angular/core';
import { type Maybe, type ArrayOrValue, type Modifier } from '@dereekb/util';
import { type Observable, map } from 'rxjs';
import { type DbxValueListItem, type DbxValueListItemDecisionFunction } from '../list.view.value';
import { AbstractDbxValueListItemModifierDirective } from './list.view.value.modifier.directive';
import { toObservable } from '@angular/core/rxjs-interop';
import { transformEmptyStringInputToUndefined } from '@dereekb/dbx-core';

/**
 * Modifier key used to identify the selection modifier in the modifier map.
 */
export const DBX_LIST_ITEM_IS_SELECTED_ITEM_MODIFIER_KEY = 'is_selected_item_modifier';

/**
 * Default decision function that returns the item's current `selected` state (defaulting to false).
 *
 * @param item - the list item to check for selection
 * @returns `true` if the item is currently selected, `false` otherwise
 */
export const DEFAULT_DBX_LIST_ITEM_IS_SELECTED_FUNCTION: DbxValueListItemDecisionFunction<unknown> = <T>(item: DbxValueListItem<T>) => {
  return item.selected ?? false;
};

/**
 * Modifier directive that sets the `selected` property on list items based on a custom decision function.
 * Useful for programmatically controlling which items appear selected in a list view.
 *
 * @example
 * ```html
 * <dbx-list-view [dbxListItemIsSelectedModifier]="isItemSelected" [config]="listViewConfig"></dbx-list-view>
 * ```
 */
@Directive({
  selector: 'dbxListItemIsSelectedModifier,[dbxListItemIsSelectedModifier]',
  standalone: true
})
export class DbxListItemIsSelectedModifierDirective<T> extends AbstractDbxValueListItemModifierDirective<T> {
  readonly listItemIsSelected = input.required<Maybe<DbxValueListItemDecisionFunction<T>>, Maybe<'' | DbxValueListItemDecisionFunction<T>>>({ alias: 'dbxListItemIsSelectedModifier', transform: transformEmptyStringInputToUndefined });

  readonly listItemIsSelectedModifiers$: Observable<Maybe<ArrayOrValue<Modifier<DbxValueListItem<T>>>>> = toObservable(this.listItemIsSelected).pipe(
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

  constructor() {
    super();
    this.setModifiers(this.listItemIsSelectedModifiers$);
  }
}
