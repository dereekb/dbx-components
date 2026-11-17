import { Directive, input, output } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { type DbxListDragDropConfig, type DbxListDragDropDelegate, type DbxListItemDropEvent, provideDbxListDragDropDelegate } from './list.drag.drop';

/**
 * Lets the user reorder a list's items by dragging them. Works with lists that render with dbx-list-view or dbx-list-grid-view,
 * including dbx-gallery.
 *
 * The list does not reorder itself. When the user drops an item, `itemDrop` emits the list's values in their new order; write
 * them back to the list's source right away (for example, a signal that feeds `[state]`). Until the new order arrives, the dropped
 * item shows at its old position.
 *
 * Limits:
 * - Items can only move within their own group (see `dbxListTitleGroup`).
 * - Paged lists only reorder the items that are loaded.
 * - There is no keyboard support.
 * - The list view does not render its separators while drag-drop is on.
 * - Disabled items, and all items while the list is disabled, cannot be dragged.
 * - `values` assumes the view maps each value to one item and keeps their order, which dbx-gallery and the usual list configs do.
 *
 * Touch drags start after a short hold (see `DEFAULT_DBX_LIST_DRAG_START_DELAY`) so the list can still be scrolled.
 *
 * @dbxWebComponent
 * @dbxWebSlug list-drag-drop
 * @dbxWebCategory list
 * @dbxWebKind directive
 * @dbxWebRelated list-view, list-grid-view, gallery
 * @dbxWebMinimalExample ```html
 * <my-list [state]="state" dbxListDragDrop (itemDrop)="items.set($event.values)"></my-list>
 * ```
 *
 * @example
 * ```html
 * <dbx-gallery [state]="state" dbxListDragDrop (itemDrop)="items.set($event.values)"></dbx-gallery>
 * <my-list [state]="state" [dbxListDragDrop]="{ disabled: locked() }" (itemDrop)="onItemDrop($event)"></my-list>
 * ```
 *
 * ```ts
 * readonly items = signal<MyItem[]>([]);
 * readonly state = computed(() => successResult(this.items()));
 * ```
 */
@Directive({
  selector: '[dbxListDragDrop]',
  exportAs: 'dbxListDragDrop',
  providers: provideDbxListDragDropDelegate(DbxListDragDropDirective)
})
export class DbxListDragDropDirective<T> implements DbxListDragDropDelegate<T> {
  readonly config = input<Maybe<DbxListDragDropConfig>, Maybe<DbxListDragDropConfig | ''>>(undefined, { alias: 'dbxListDragDrop', transform: (x) => (x === '' ? undefined : x) });

  /**
   * Emits when the user drops an item at a new position.
   */
  readonly itemDrop = output<DbxListItemDropEvent<T>>();

  readonly configSignal = this.config;

  dropItem(event: DbxListItemDropEvent<T>): void {
    this.itemDrop.emit(event);
  }
}
