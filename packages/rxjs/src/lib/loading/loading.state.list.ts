import { type PageNumber } from '@dereekb/util';
import { map, type Observable, type OperatorFunction } from 'rxjs';
import { type ListLoadingState, type PageLoadingState } from './loading.state';
import { loadingStateFromObs } from './loading.state.rxjs';

// TODO: breaking change refactor: Switch the names of these functions below, so the isListLoadingStateEmpty is the non-operator function.

/**
 * Returns true if the loading state is not loading and is empty.
 *
 * @param listLoadingState
 * @returns
 */
export function listLoadingStateIsEmpty<T = unknown>(listLoadingState: ListLoadingState<T>): boolean {
  return Boolean(!listLoadingState.value || !listLoadingState.value.length);
}

export function isListLoadingStateEmpty<T = unknown>(): OperatorFunction<ListLoadingState<T>, boolean> {
  return map(listLoadingStateIsEmpty);
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
