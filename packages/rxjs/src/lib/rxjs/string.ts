import { Maybe, searchStringFilterFunction, SearchStringFilterFunctionConfigInput } from '@dereekb/util';
import { map, MonoTypeOperatorFunction, Observable, switchMap } from 'rxjs';

/**
 * filterWithSearchString() configuration
 */
export interface SearchStringFilterConfig<T> {
  readonly filter: SearchStringFilterFunctionConfigInput<T>;
  readonly search$: Observable<Maybe<string>>;
}

/**
 * Uses a SearchStringFilterFunction to filter values.
 */
export function filterWithSearchString<T>(config: SearchStringFilterConfig<T>): MonoTypeOperatorFunction<T[]> {
  const { filter, search$ } = config;
  const filterFactory = searchStringFilterFunction(filter);
  return switchMap((values: T[]) => {
    return search$.pipe(
      map((search) => {
        if (search != null) {
          return filterFactory(search, values);
        } else {
          return values;
        }
      })
    );
  });
}
