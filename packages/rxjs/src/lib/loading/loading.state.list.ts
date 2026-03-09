import { type PageNumber } from '@dereekb/util';
import { map, type Observable, type OperatorFunction } from 'rxjs';
import { type LoadingStateValue, type ListLoadingState, type PageLoadingState } from './loading.state';
import { loadingStateFromObs, valueFromFinishedLoadingState } from './loading.state.rxjs';

/**
 * Whether the {@link ListLoadingState} has no value or an empty array.
 *
 * Returns true if the value is nullish or has zero length, regardless of loading status.
 *
 * @example
 * ```ts
 * isListLoadingStateWithEmptyValue(successResult([])); // true
 * isListLoadingStateWithEmptyValue(successResult([1, 2])); // false
 * isListLoadingStateWithEmptyValue(beginLoading()); // true (no value)
 * ```
 *
 * @param listLoadingState - the list loading state to check
 * @returns true if the value is empty or absent
 */
export function isListLoadingStateWithEmptyValue<T>(listLoadingState: ListLoadingState<T>): boolean {
  return Boolean(!listLoadingState.value || !listLoadingState.value.length);
}

/**
 * RxJS operator that maps each emitted {@link ListLoadingState} to a boolean indicating whether the list is empty.
 *
 * @example
 * ```ts
 * of(successResult([])).pipe(
 *   mapIsListLoadingStateWithEmptyValue()
 * ).subscribe((isEmpty) => console.log(isEmpty)); // true
 * ```
 *
 * @returns an operator that emits true when the list value is empty or absent
 */
export function mapIsListLoadingStateWithEmptyValue<T>(): OperatorFunction<ListLoadingState<T>, boolean> {
  return map(isListLoadingStateWithEmptyValue);
}

/**
 * Wraps an observable and converts its emissions into a {@link PageLoadingState} for the given page number.
 *
 * Uses {@link loadingStateFromObs} internally and attaches the page number to each emitted state.
 *
 * @example
 * ```ts
 * const pageState$ = pageLoadingStateFromObs(fetchItems$, false, 2);
 * // emits: { loading: true, page: 2 }, then { value: items, loading: false, page: 2 }
 * ```
 *
 * @param obs - the source observable to wrap
 * @param firstOnly - if true, only takes the first value
 * @param page - the page number to attach (defaults to 0)
 * @returns an observable of page loading states
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
 * RxJS operator that extracts the array value from a finished {@link ListLoadingState},
 * defaulting to an empty array when no value is present.
 *
 * Combines {@link valueFromFinishedLoadingState} with a default of `[]`.
 *
 * @example
 * ```ts
 * of(successResult([1, 2, 3])).pipe(
 *   arrayValueFromFinishedLoadingState()
 * ).subscribe((items) => console.log(items)); // [1, 2, 3]
 *
 * of(successResult(null)).pipe(
 *   arrayValueFromFinishedLoadingState()
 * ).subscribe((items) => console.log(items)); // []
 * ```
 *
 * @returns an operator that emits the array value or an empty array
 */
export function arrayValueFromFinishedLoadingState<L extends ListLoadingState>(): OperatorFunction<L, LoadingStateValue<L>> {
  return (obs: Observable<L>) => {
    return obs.pipe(valueFromFinishedLoadingState<L>(() => [] as LoadingStateValue<L>));
  };
}
