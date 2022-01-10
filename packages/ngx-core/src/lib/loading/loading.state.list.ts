import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ServerError } from '../error/api.error';
import { LoadingState, loadingStateFromObs } from './loading.state';

/**
 * Page value used when no list items have been loaded.
 */
export const UNLOADED_PAGE = -1;

/**
 * The first page of results.
 */
export const FIRST_PAGE = 0;

/**
 * Page value used when there are no elements left to load.
 */
export const FINAL_PAGE = -2;


// MARK: List
export type ModelResultsPage = number;

/**
 * Used with ModelListState for adding results.
 */
export interface ModelListPageResults<T> {
  /**
   * Page that was returned.
   */
  page: ModelResultsPage;
  /**
   * New models within the result.
   */
  results: T[];
}

/**
 * State for a model list.
 */
export interface ModelListState<T> extends LoadingState<T[]> {
  /**
   * The page that is currently being retrieved.
   */
  retrieving?: ModelResultsPage;
  /**
   * Current page that is loaded.
   */
  page?: ModelResultsPage;
  /**
   * Last time the models value was updated at.
   *
   * @deprecated Unused.
   */
  updatedAt?: number;
  /**
   * Error when retrieving the list.
   */
  error?: ServerError;
}

// MARK: Filtered
/**
 * Filter component.
 */
export interface ModelListFilter<F> {
  filter?: F;
}

export interface FilteredModelListState<T, F> extends ModelListState<T>, ModelListFilter<F> { }

// MARK: Utility
export function lastPageModelListPageResults<T>(results: T[] = []): ModelListPageResults<T> {
  return {
    page: FINAL_PAGE,
    results
  };
}

/**
 * Wraps an observable output and maps the value to a LoadingState.
 */
export function listLoadingStateFromObs<T>(obs: Observable<T[]>, firstOnly?: boolean): Observable<ModelListState<T>> {
  return loadingStateFromObs<T[]>(obs, firstOnly).pipe(
    map((x: LoadingState<T[]>) => ({ ...x, retrieving: (x.loading) ? FIRST_PAGE : undefined, page: (x.loading) ? undefined : FIRST_PAGE }))
  );
}
