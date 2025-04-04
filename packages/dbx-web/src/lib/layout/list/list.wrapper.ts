import { Observable } from 'rxjs';
import { ListLoadingState, MaybeObservableOrValue } from '@dereekb/rxjs';
import { forwardRef, OutputRef, Provider, Type } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { DbxListSelectionMode } from './list.view';

/**
 * Common interface for views that may wrap a DbxListView, and pass values through to it.
 */
export abstract class DbxListViewWrapper<T = unknown, S extends ListLoadingState<T> = ListLoadingState<T>> {
  abstract readonly currentState$: Observable<Maybe<S>>;
  abstract readonly loadMore?: OutputRef<void>;
  /**
   * Sets/overrides the state for this view.
   */
  abstract setState(state: MaybeObservableOrValue<S>): void;
  /**
   * Sets/overrides the selection mode for this view.
   */
  abstract setSelectionMode(selectionMode: MaybeObservableOrValue<DbxListSelectionMode>): void;
}

export function provideDbxListViewWrapper<V extends DbxListViewWrapper>(sourceType: Type<V>): Provider[] {
  return [
    {
      provide: DbxListViewWrapper,
      useExisting: forwardRef(() => sourceType)
    }
  ];
}
