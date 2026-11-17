import { forwardRef, type Provider, type Signal, type Type } from '@angular/core';
import { type DragStartDelay, moveItemInArray } from '@angular/cdk/drag-drop';
import { type IndexNumber, type Maybe } from '@dereekb/util';
import { type DbxValueListItem } from '../list.view.value';

/**
 * Emitted when the user drops a list item at a new position.
 *
 * The indexes refer to the list's full (flat) item array, not to the item's group. The list does not reorder itself: write
 * {@link DbxListItemDropEvent.values} back to the list's source right away to keep the new order.
 */
export interface DbxListItemDropEvent<T> {
  /**
   * The value of the item that was moved.
   */
  readonly value: T;
  /**
   * The key of the item that was moved.
   */
  readonly key: string;
  /**
   * The item's index in the list before the move.
   */
  readonly previousIndex: IndexNumber;
  /**
   * The item's index in the list after the move.
   */
  readonly currentIndex: IndexNumber;
  /**
   * All of the list's values in their new order. This is a new array.
   */
  readonly values: T[];
}

/**
 * Configuration for drag-to-reorder on a list.
 */
export interface DbxListDragDropConfig {
  /**
   * Whether dragging is disabled.
   */
  readonly disabled?: Maybe<boolean>;
  /**
   * How long, in milliseconds, the user has to hold down before a drag starts.
   *
   * Defaults to {@link DEFAULT_DBX_LIST_DRAG_START_DELAY}.
   */
  readonly dragStartDelay?: Maybe<DragStartDelay>;
}

/**
 * Default drag start delay. Touch drags start after a 300ms hold so touch devices can still scroll the list, and mouse drags start right away.
 */
export const DEFAULT_DBX_LIST_DRAG_START_DELAY: DragStartDelay = { touch: 300, mouse: 0 };

/**
 * Abstract delegate and injection token that turns on drag-to-reorder for the list views that support it (dbx-list-view and dbx-list-grid-view).
 *
 * The list views pick the delegate up through DI. When it is not available, the list views render without drag-drop.
 */
export abstract class DbxListDragDropDelegate<T = unknown> {
  /**
   * The current drag-drop configuration.
   */
  abstract readonly configSignal: Signal<Maybe<DbxListDragDropConfig>>;
  /**
   * Called when the user drops an item at a new position.
   *
   * @param event - The drop event.
   */
  abstract dropItem(event: DbxListItemDropEvent<T>): void;
}

/**
 * Registers a directive as the {@link DbxListDragDropDelegate} provider for dependency injection.
 *
 * @param sourceType - The directive class to register as the DbxListDragDropDelegate provider.
 * @returns Array of Angular providers that wire up the directive as a DbxListDragDropDelegate.
 *
 * @example
 * ```ts
 * @Directive({
 *   providers: provideDbxListDragDropDelegate(MyDragDropDirective)
 * })
 * export class MyDragDropDirective implements DbxListDragDropDelegate<MyItem> { ... }
 * ```
 */
export function provideDbxListDragDropDelegate<S extends DbxListDragDropDelegate>(sourceType: Type<S>): Provider[] {
  return [
    {
      provide: DbxListDragDropDelegate,
      useExisting: forwardRef(() => sourceType)
    }
  ];
}

/**
 * Input for {@link dbxListItemDropEvent}.
 */
export interface DbxListItemDropEventConfig<T, I extends DbxValueListItem<T> = DbxValueListItem<T>> {
  /**
   * All of the list's items, in list order.
   */
  readonly flatItems: I[];
  /**
   * The items of the group the item was moved in. Must be the same objects as in flatItems.
   */
  readonly groupItems: I[];
  /**
   * The item's index in the group before the move.
   */
  readonly previousGroupIndex: IndexNumber;
  /**
   * The item's index in the group after the move.
   */
  readonly currentGroupIndex: IndexNumber;
}

/**
 * Creates the {@link DbxListItemDropEvent} for an item that was moved within its group.
 *
 * The drop list reports indexes within the group. These are converted to indexes in the list's full item array, then the move is
 * applied to a copy of the list's values.
 *
 * @param config - The list's items, the group's items, and the item's group indexes before and after the move.
 * @returns The drop event, or undefined if nothing moved or the items could not be found.
 *
 * @example
 * ```ts
 * const event = dbxListItemDropEvent({ flatItems: items, groupItems: items, previousGroupIndex: 0, currentGroupIndex: 2 });
 * // event.values has the first value moved to the third position.
 * ```
 */
export function dbxListItemDropEvent<T, I extends DbxValueListItem<T> = DbxValueListItem<T>>(config: DbxListItemDropEventConfig<T, I>): Maybe<DbxListItemDropEvent<T>> {
  const { flatItems, groupItems, previousGroupIndex, currentGroupIndex } = config;
  let result: Maybe<DbxListItemDropEvent<T>>;

  const movedItem: Maybe<I> = groupItems[previousGroupIndex];
  const targetItem: Maybe<I> = groupItems[currentGroupIndex];

  if (previousGroupIndex !== currentGroupIndex && movedItem != null && targetItem != null) {
    const previousIndex = flatItems.indexOf(movedItem);
    const currentIndex = flatItems.indexOf(targetItem);

    if (previousIndex !== -1 && currentIndex !== -1) {
      const values = flatItems.map((x) => x.itemValue);
      moveItemInArray(values, previousIndex, currentIndex);

      result = {
        value: movedItem.itemValue,
        key: movedItem.key,
        previousIndex,
        currentIndex,
        values
      };
    }
  }

  return result;
}
