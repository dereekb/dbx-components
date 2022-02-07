import { Observable } from 'rxjs';
import { ListLoadingState, ListLoadingStateContext } from "@dereekb/rxjs";
import { EventEmitter, forwardRef, Provider, Type } from "@angular/core";

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
export abstract class DbxListView<T, S extends ListLoadingState<T> = ListLoadingState<T>> {
  /**
   * Values of the list view.
   */
  abstract readonly values$: Observable<T[]>;
  /**
   * (Optional) clicked event emitter.
   * 
   * If available, the DbxList will subscribe to it automatically.
   */
  abstract clickValue?: EventEmitter<T>;
  /**
   * (Optional) selection changed event emitter.
   * 
   * If available, the DbxList will subscribe to it automatically.
   */
  abstract selectionChange?: EventEmitter<ListSelectionState<T>>;
  /**
   * Sets the models input loading state context for the view to render from.
   */
  abstract setListContext(state: ListLoadingStateContext<T, S>): void;
}

export function ProvideDbxListView<V extends DbxListView<any>>(sourceType: Type<V>): Provider[] {
  return [{
    provide: DbxListView,
    useExisting: forwardRef(() => sourceType)
  }];
}
