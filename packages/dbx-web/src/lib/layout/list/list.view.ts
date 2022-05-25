import { Observable } from 'rxjs';
import { ListLoadingState, ListLoadingStateContext } from "@dereekb/rxjs";
import { EventEmitter, forwardRef, Provider, Type } from "@angular/core";
import { Maybe } from '@dereekb/util';

export type DbxListSelectionMode = 'select' | 'view';

export interface ListSelectionStateItem<T> {
  disabled?: boolean;
  selected?: boolean;
  itemValue: T;
}

export interface ListSelectionState<T> {
  items: ListSelectionStateItem<T>[];
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
  /**
   * Sets the disabled state of the list view.
   */
  abstract setDisabled(disabled: boolean): void;
  /**
   * Sets the selection mode of the list view.
   */
  abstract setSelectionMode(selectionMode: Maybe<DbxListSelectionMode>): void;
}

// eslint-disable-next-line
export function provideDbxListView<V extends DbxListView<any>>(sourceType: Type<V>): Provider[] {   // use of any here is allowed as typings are not relevant for providers
  return [{
    provide: DbxListView,
    useExisting: forwardRef(() => sourceType)
  }];
}
