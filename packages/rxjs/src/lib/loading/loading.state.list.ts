import { loadingStateFromObs } from '@dereekb/rxjs';
import { PageNumber } from '@dereekb/util';
import { filter, map, Observable, OperatorFunction } from 'rxjs';
import { ListLoadingState, loadingStateIsLoading, PageLoadingState } from './loading.state';

export function listLoadingStateIsEmpty<T = unknown>(listLoadingState: ListLoadingState<T>): boolean {
  return Boolean(listLoadingState.value && !(listLoadingState.value?.length > 0));
}

export function isListLoadingStateEmpty<T = unknown>(): OperatorFunction<ListLoadingState<T>, boolean> {
  return (obs: Observable<ListLoadingState<T>>) => {
    return obs.pipe(
      filter((x) => !loadingStateIsLoading(x)),
      map((x) => Boolean(x.value && !(x.value?.length > 0)))
    );
  };
}

/**
 * Wraps an observable output and maps the value to a PageLoadingState.
 */
export function pageLoadingStateFromObs<T>(obs: Observable<T>, firstOnly?: boolean, page: PageNumber = 0): Observable<PageLoadingState<T>> {
  return loadingStateFromObs(obs, firstOnly).pipe(
    map((x) => {
      (x as PageLoadingState<T>).page = page;
      return x as PageLoadingState<T>;
    })
  );
}
