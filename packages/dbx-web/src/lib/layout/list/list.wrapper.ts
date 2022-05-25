import { Observable } from 'rxjs';
import { ListLoadingState } from "@dereekb/rxjs";
import { forwardRef, Provider, Type } from "@angular/core";
import { Maybe } from '@dereekb/util';

/**
 * Common interface for views that may wrap a DbxListView, and pass values through to it.
 */
 export abstract class DbxListViewWrapper<T = unknown, S extends ListLoadingState<T> = ListLoadingState<T>> {
  state$?: Maybe<Observable<S>>;
}

export function provideDbxListViewWrapper<V extends DbxListViewWrapper>(sourceType: Type<V>): Provider[] {
  return [{
    provide: DbxListViewWrapper,
    useExisting: forwardRef(() => sourceType)
  }];
}
