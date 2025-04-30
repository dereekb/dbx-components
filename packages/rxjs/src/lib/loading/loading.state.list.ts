import { Maybe, type PageNumber } from '@dereekb/util';
import { map, type Observable, type OperatorFunction } from 'rxjs';
import { LoadingStateValue, type ListLoadingState, type PageLoadingState } from './loading.state';
import { loadingStateFromObs, valueFromFinishedLoadingState } from './loading.state.rxjs';

/**
 * Returns true if the loading state is not loading and is empty.
 *
 * @param listLoadingState
 * @returns
 */
export function isListLoadingStateWithEmptyValue<T>(listLoadingState: ListLoadingState<T>): boolean {
  return Boolean(!listLoadingState.value || !listLoadingState.value.length);
}

/**
 * Convenience function that merges map() with isListLoadingStateWithEmptyValue()
 *
 * @returns
 */
export function mapIsListLoadingStateWithEmptyValue<T>(): OperatorFunction<ListLoadingState<T>, boolean> {
  return map(isListLoadingStateWithEmptyValue);
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

/**
 * Returns the value once the LoadingState has finished loading, even if an error occured.
 * 
 * The value is defaulted to an empty array.
 *
 * @returns Observable of the value
 */
export function arrayValueFromFinishedLoadingState<L extends ListLoadingState>(): OperatorFunction<L, LoadingStateValue<L>> {
  return (obs: Observable<L>) => {
    return obs.pipe(
      valueFromFinishedLoadingState<L>(() => ([] as LoadingStateValue<L>))
    );
  };
}

// MARK: Compat
/**
 * @deprecated use isListLoadingStateWithEmptyValue instead.
 */
export const listLoadingStateIsEmpty = isListLoadingStateWithEmptyValue;

/**
 * @deprecated use mapIsListLoadingStateWithEmptyValue instead.
 */
export const isListLoadingStateEmpty = mapIsListLoadingStateWithEmptyValue;
