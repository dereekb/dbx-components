import { Directive, effect, inject, input, output } from '@angular/core';
import { type Maybe, type Modifier } from '@dereekb/util';
import { cleanSubscription } from '@dereekb/dbx-core';
import { combineLatest, distinctUntilChanged, filter, map, type Observable, pairwise, skip, startWith } from 'rxjs';
import { type DbxValueListItem } from '../list.view.value';
import { AbstractDbxValueListItemModifierDirective } from '../modifier/list.view.value.modifier.directive';
import { type DbxListSingleSelectionChange, type DbxListSingleSelectionConfig, type DbxListSingleSelectionEntry } from './list.single.selection';
import { DbxListSingleSelectionStore, provideDbxListSingleSelectionStoreIfParentIsUnavailable } from './list.single.selection.store';

/**
 * Modifier key used to identify the single-selection modifier in the modifier map.
 */
export const DBX_LIST_ITEM_SINGLE_SELECTION_MODIFIER_KEY = 'single_selection';

/**
 * Creates the list item modifier used by {@link DbxListItemSingleSelectionModifierDirective}.
 *
 * Marks the item with the selected key as selected and wraps each item's anchor so clicking it toggles the item in the store.
 * Any existing anchor `onClick` still runs first.
 *
 * @param store - The selection store to read from and update.
 * @param selectedKey - The currently selected key.
 * @returns The list item modifier.
 */
export function dbxListItemSingleSelectionModifier<T>(store: DbxListSingleSelectionStore<T>, selectedKey: Maybe<string>): Modifier<DbxValueListItem<T>> {
  return {
    key: DBX_LIST_ITEM_SINGLE_SELECTION_MODIFIER_KEY,
    modify: (item: DbxValueListItem<T>) => {
      const existingAnchor = item.anchor;
      const existingOnClick = existingAnchor?.onClick;
      const key = item.key;

      item.selected = selectedKey != null && key === selectedKey;
      item.anchor = {
        ...existingAnchor,
        onClick: () => {
          existingOnClick?.();
          store.toggle({ key, value: item.itemValue });
        }
      };
    }
  };
}

/**
 * Adds single selection to a list. Clicking an item selects it, and the selected item is rendered as selected by the list view.
 *
 * Uses a parent {@link DbxListSingleSelectionStore} when one is provided, so a page can share the selection with other
 * components; otherwise the directive gets its own store. Use alongside `dbxListItemModifier` on the list.
 *
 * Because the items get a clickable anchor, the list no longer emits `clickItem` for them; use `selectionChange` instead.
 *
 * @dbxWebComponent
 * @dbxWebSlug list-item-single-selection-modifier
 * @dbxWebCategory list
 * @dbxWebKind directive
 * @dbxWebRelated list, list-view, list-grid-view, gallery
 * @dbxWebMinimalExample ```html
 * <my-list [state]="state$" dbxListItemModifier dbxListItemSingleSelectionModifier (selectionChange)="onSelectionChange($event)"></my-list>
 * ```
 *
 * @example
 * ```html
 * <my-list [state]="state$" dbxListItemModifier [dbxListItemSingleSelectionModifier]="{ allowDeselect: true }" #selection="dbxListItemSingleSelection"></my-list>
 * <p>Selected: {{ selection.store.selectedValueSignal()?.name }}</p>
 * ```
 */
@Directive({
  selector: '[dbxListItemSingleSelectionModifier]',
  exportAs: 'dbxListItemSingleSelection',
  providers: [provideDbxListSingleSelectionStoreIfParentIsUnavailable()]
})
export class DbxListItemSingleSelectionModifierDirective<T> extends AbstractDbxValueListItemModifierDirective<T> {
  readonly store = inject(DbxListSingleSelectionStore<T>);

  readonly config = input<Maybe<DbxListSingleSelectionConfig>, Maybe<DbxListSingleSelectionConfig | ''>>(undefined, { alias: 'dbxListItemSingleSelectionModifier', transform: (x) => (x === '' ? undefined : x) });

  readonly selectionChange = output<DbxListSingleSelectionChange<T>>();

  /**
   * Emits whenever another modifier is linked after the selection modifier, so the selection modifier can re-link and run last.
   *
   * The selection modifier wraps the anchor set by other modifiers (such as `dbxListItemAnchorModifier`), so it must run after them.
   * Only emits on the change to "not last", so a modifier that always stays after it (such as one from the `dbxListItemModifier` input) does not cause a loop.
   */
  private readonly _selectionModifierNotLast$: Observable<boolean> = this.dbxValueListItemModifier.modifiers$.pipe(
    filter((modifiers) => modifiers.has(DBX_LIST_ITEM_SINGLE_SELECTION_MODIFIER_KEY)),
    map((modifiers) => {
      const keys = Array.from(modifiers.keys());
      return keys[keys.length - 1] !== DBX_LIST_ITEM_SINGLE_SELECTION_MODIFIER_KEY;
    }),
    distinctUntilChanged(),
    filter((notLast) => notLast)
  );

  readonly selectionModifier$: Observable<Modifier<DbxValueListItem<T>>> = combineLatest([this.store.selectedKey$, this._selectionModifierNotLast$.pipe(startWith(true))]).pipe(map(([selectedKey]) => dbxListItemSingleSelectionModifier(this.store, selectedKey)));

  protected readonly _allowDeselectEffect = effect(() => {
    const allowDeselect = this.config()?.allowDeselect;

    if (allowDeselect != null) {
      this.store.setAllowDeselect(allowDeselect);
    }
  });

  constructor() {
    super();
    this.setModifiers(this.selectionModifier$);

    const selected$: Observable<Maybe<DbxListSingleSelectionEntry<T>>> = this.store.selected$.pipe(distinctUntilChanged((a, b) => a?.key === b?.key));

    cleanSubscription(
      selected$
        .pipe(
          startWith(undefined),
          pairwise(),
          skip(1) // skip the initial value pair
        )
        .subscribe(([previous, selected]) => {
          this.selectionChange.emit({ selected, previous });
        })
    );
  }
}
