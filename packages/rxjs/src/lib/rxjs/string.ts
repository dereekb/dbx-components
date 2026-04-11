import { type Maybe, searchStringFilterFunction, type SearchStringFilterFunctionConfigInput } from '@dereekb/util';
import { map, type MonoTypeOperatorFunction, type Observable, switchMap } from 'rxjs';

/**
 * filterWithSearchString() configuration
 */
export interface SearchStringFilterConfig<T> {
  readonly filter: SearchStringFilterFunctionConfigInput<T>;
  readonly search$: Observable<Maybe<string>>;
}

/**
 * RxJS operator that filters an emitted array by a reactive search string.
 *
 * Combines the source array with the `search$` observable and applies the configured
 * search string filter function. When the search is null/undefined, all items pass through.
 *
 * @example
 * ```ts
 * const items$ = of(['apple', 'banana', 'cherry']);
 * const search$ = new BehaviorSubject<string>('an');
 *
 * items$.pipe(
 *   filterWithSearchString({ filter: (x) => x, search$ })
 * ).subscribe(console.log);
 * // ['banana']
 * ```
 *
 * @param config - search filter configuration with filter function and search$ observable
 * @returns an operator that filters arrays by search string
 */
export function filterWithSearchString<T>(config: SearchStringFilterConfig<T>): MonoTypeOperatorFunction<T[]> {
  const { filter, search$ } = config;
  const filterFactory = searchStringFilterFunction(filter);
  return switchMap((values: T[]) => {
    return search$.pipe(
      map((search) => {
        return search != null ? filterFactory(search, values) : values;
      })
    );
  });
}
