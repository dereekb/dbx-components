import { type Observable } from 'rxjs';
import { type ListLoadingState, type MaybeObservableOrValue } from '@dereekb/rxjs';
import { forwardRef, type OutputRef, type Provider, type Type } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { type DbxListSelectionMode } from './list.view';

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

/**
 * Registers a component as a {@link DbxListViewWrapper} provider for dependency injection.
 *
 * @example
 * ```ts
 * @Component({
 *   providers: provideDbxListViewWrapper(MyListWrapperComponent)
 * })
 * export class MyListWrapperComponent extends DbxListViewWrapper<MyItem> { ... }
 * ```
 *
 * @param sourceType - the component class to register as the DbxListViewWrapper provider
 * @returns an array of Angular providers that wire up the component as a DbxListViewWrapper
 */
export function provideDbxListViewWrapper<V extends DbxListViewWrapper>(sourceType: Type<V>): Provider[] {
  return [
    {
      provide: DbxListViewWrapper,
      useExisting: forwardRef(() => sourceType)
    }
  ];
}
