import { type PageNumber } from '@dereekb/util';
import { map, type Observable, type OperatorFunction } from 'rxjs';
import { type LoadingStateValue, type ListLoadingState, type PageLoadingState } from './loading.state';
import { loadingStateFromObs, valueFromFinishedLoadingState } from './loading.state.rxjs';

/**
 * Whether the {@link ListLoadingState} has no value or an empty array.
 *
 * Returns true if the value is nullish or has zero length, regardless of loading status.
 *
 * @param listLoadingState - The list loading state to check.
 * @returns True if the value is empty or absent.
 *
 * @example
 * ```ts
 * isListLoadingStateWithEmptyValue(successResult([])); // true
 * isListLoadingStateWithEmptyValue(successResult([1, 2])); // false
 * isListLoadingStateWithEmptyValue(beginLoading()); // true (no value)
 * ```
 */
export function isListLoadingStateWithEmptyValue<T>(listLoadingState: ListLoadingState<T>): boolean {
  return Boolean(!listLoadingState.value?.length);
}

/**
 * RxJS operator that maps each emitted {@link ListLoadingState} to a boolean indicating whether the list is empty.
 *
 * @returns An operator that emits true when the list value is empty or absent.
 *
 * @example
 * ```ts
 * of(successResult([])).pipe(
 *   mapIsListLoadingStateWithEmptyValue()
 * ).subscribe((isEmpty) => console.log(isEmpty)); // true
 * ```
 */
export function mapIsListLoadingStateWithEmptyValue<T>(): OperatorFunction<ListLoadingState<T>, boolean> {
  return map(isListLoadingStateWithEmptyValue);
}

/**
 * Wraps an observable and converts its emissions into a {@link PageLoadingState} for the given page number.
 *
 * Uses {@link loadingStateFromObs} internally and attaches the page number to each emitted state.
 *
 * @param obs - The source observable to wrap.
 * @param firstOnly - If true, only takes the first value.
 * @param page - The page number to attach (defaults to 0)
 * @returns An observable of page loading states.
 *
 * @example
 * ```ts
 * const pageState$ = pageLoadingStateFromObs(fetchItems$, false, 2);
 * // emits: { loading: true, page: 2 }, then { value: items, loading: false, page: 2 }
 * ```
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
 * @returns An operator that emits the array value or an empty array.
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
 */
export function arrayValueFromFinishedLoadingState<L extends ListLoadingState>(): OperatorFunction<L, LoadingStateValue<L>> {
  return (obs: Observable<L>) => {
    return obs.pipe(valueFromFinishedLoadingState<L>(() => [] as LoadingStateValue<L>));
  };
}
