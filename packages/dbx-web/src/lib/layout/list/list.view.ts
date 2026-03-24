import { type Observable } from 'rxjs';
import { type ListLoadingState, type ListLoadingStateContext } from '@dereekb/rxjs';
import { forwardRef, type OutputEmitterRef, type Provider, type TrackByFunction, type Type } from '@angular/core';
import { type Maybe } from '@dereekb/util';

/**
 * Determines how list items behave when interacted with. In 'select' mode, items can be selected/deselected.
 * In 'view' mode, items are simply clickable for navigation or viewing.
 */
export type DbxListSelectionMode = 'select' | 'view';

/**
 * Represents the selection state of a single list item, including whether it is disabled or selected.
 */
export interface ListSelectionStateItem<T> {
  readonly disabled?: boolean;
  readonly selected?: boolean;
  readonly itemValue: T;
}

/**
 * Represents the aggregate selection state of all items in a list, emitted when selection changes occur.
 */
export interface ListSelectionState<T> {
  readonly items: ListSelectionStateItem<T>[];
}

/**
 * Interface for a view that renders the items of a DbxList.
 */
export abstract class DbxListView<T, S extends ListLoadingState<T> = ListLoadingState<T>> {
  /**
   * Current disabled state.
   */
  abstract readonly disabled$: Observable<boolean>;
  /**
   * (Optional) current selection mode.
   */
  abstract readonly selectionMode$?: Observable<Maybe<DbxListSelectionMode>>;
  /**
   * Values of the list view.
   */
  abstract readonly values$: Observable<T[]>;
  /**
   * Track by configuration.
   */
  abstract readonly trackBy$?: Observable<Maybe<TrackByFunction<T>>>;
  /**
   * (Optional) clicked event emitter.
   *
   * If available, the DbxList will subscribe to it automatically.
   */
  abstract clickValue?: OutputEmitterRef<T>;
  /**
   * (Optional) selection changed event emitter.
   *
   * If available, the DbxList will subscribe to it automatically.
   */
  abstract selectionChange?: OutputEmitterRef<ListSelectionState<T>>;
  /**
   * Sets the models input loading state context for the view to render from.
   */
  abstract setListContext(state: ListLoadingStateContext<T, S>): void;
  /**
   * Sets the disabled state of the list view.
   */
  abstract setDisabled(disabled: boolean): void;
  /**
   * Sets the selection mode of the list view.
   */
  abstract setSelectionMode(selectionMode: Maybe<DbxListSelectionMode>): void;
}

/**
 * Registers a component as a {@link DbxListView} provider so it can be injected by parent list components.
 *
 * @example
 * ```ts
 * @Component({
 *   providers: provideDbxListView(MyCustomListViewComponent)
 * })
 * export class MyCustomListViewComponent extends DbxListView<MyItem> { ... }
 * ```
 *
 * @param sourceType - the component class to register as the DbxListView provider
 * @returns an array of Angular providers that wire up the component as a DbxListView
 */
 
export function provideDbxListView<V extends DbxListView<any>>(sourceType: Type<V>): Provider[] {
  // use of any here is allowed as typings are not relevant for providers
  return [
    {
      provide: DbxListView,
      useExisting: forwardRef(() => sourceType)
    }
  ];
}
