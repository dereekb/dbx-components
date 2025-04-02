import { Observable } from 'rxjs';
import { ListLoadingState } from '@dereekb/rxjs';
import { EventEmitter, forwardRef, OutputRef, Provider, Type } from '@angular/core';
import { type Maybe } from '@dereekb/util';

/**
 * Common interface for views that may wrap a DbxListView, and pass values through to it.
 */
export abstract class DbxListViewWrapper<T = unknown, S extends ListLoadingState<T> = ListLoadingState<T>> {
  abstract readonly currentState$: Observable<Maybe<S>>;
  abstract readonly loadMore?: OutputRef<void>;
  /**
   * Updates the state observable for this view.
   */
  abstract setStateObs(stateObs: Observable<S>): void;
}

export function provideDbxListViewWrapper<V extends DbxListViewWrapper>(sourceType: Type<V>): Provider[] {
  return [
    {
      provide: DbxListViewWrapper,
      useExisting: forwardRef(() => sourceType)
    }
  ];
}
