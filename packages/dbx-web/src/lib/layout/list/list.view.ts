import { ListLoadingState, ListLoadingStateContext } from "@dereekb/rxjs";
import { EventEmitter } from "@angular/core";

export interface ListSelectionStateItem<T> {
  disabled?: boolean;
  selected?: boolean;
  value: T;
}

export interface ListSelectionState<T> {
  items: ListSelectionStateItem<T>[];
}

/**
 * Interface for a view that renders the items of a DbxList.
 */
export interface DbxListView<T, S extends ListLoadingState<T> = ListLoadingState<T>> {
  /**
   * (Optional) clicked event emitter.
   * 
   * If available, the DbxList will subscribe to it automatically.
   */
  clickValue?: EventEmitter<T>;
  /**
   * (Optional) selection changed event emitter.
   * 
   * If available, the DbxList will subscribe to it automatically.
   */
  selectionChange?: EventEmitter<ListSelectionState<T>>;
  /**
   * Sets the models input loading state context for the view to render from.
   */
  setListContext(state: ListLoadingStateContext<T, S>): void;
}
