import { BehaviorSubject, isObservable, Observable, of } from 'rxjs';
import { delay, first, map, mergeMap, shareReplay, startWith, switchMap, tap } from 'rxjs/operators';
import { LoadingContext, LoadingEvent } from './loading';
import { LoadingState, loadingStateFromObs } from './loading.state';
import { FIRST_PAGE, ModelListState } from './loading.state.list';
import { hasResults, isRetrievingFirstPage } from './loading.state.list.reducer';

export interface ModelListLoadingEvent<T> extends LoadingEvent {
  list?: T[];
}

export interface LoadingEventForModelListStateConfig<T extends ModelListState<any> = ModelListState<any>> {
  /**
   * The initial observable.
   */
  obs?: Observable<T>;
  /**
   * Whether or not to show the loading bar when retrieving models.
   */
  alwaysShowLoadingOnRetrieving?: boolean;
  /**
   * Number of items in the list to limit in the result.
   */
  limit?: number;
}

export function loadingEventForModelListState<S>(state: ModelListState<S>, { alwaysShowLoadingOnRetrieving = false, limit }: LoadingEventForModelListStateConfig = {}): ModelListLoadingEvent<S> {
  const stateHasResults = hasResults(state);

  let isLoading = state?.loading;
  const error = state?.error;
  let list = state?.model;

  if (list && limit) {
    list = list.slice(0, limit);
  }

  if (state?.retrieving !== undefined) {
    // Show loading regardless of the state.
    if (alwaysShowLoadingOnRetrieving !== false) {
      isLoading = true;
    } else {
      // Is only loading if we're retrieving the first page and have no results.
      isLoading = isLoading && isRetrievingFirstPage(state);
    }
  } else {
    isLoading = !stateHasResults;
  }

  return {
    isLoading,
    error,
    list
  };
}

/**
 * LoadingContext implementation that uses a ModelListState observable.
 */
export class ModelListLoadingContext<L = any, S extends ModelListState<L> = ModelListState<L>> implements LoadingContext {

  private _isLoading = true;
  private _stateSubject$ = new BehaviorSubject<Observable<S>>(undefined);

  private _config: LoadingEventForModelListStateConfig<S>;

  readonly state$ = this._stateSubject$.pipe(switchMap(x => x));
  readonly stateObs$: Observable<Observable<S>> = this._stateSubject$.asObservable();

  public readonly stream$: Observable<ModelListLoadingEvent<L>> = this._stateSubject$.pipe(
    mergeMap((obs) => {
      const start = {
        isLoading: true
      };

      if (obs) {
        return obs.pipe(
          startWith(start as any as S), // Always start with loading. Observable may not always update immediately.
          map((x) => loadingEventForModelListState(x, this._config))
        );
      } else {
        return of(start);
      }
    }),
    tap(({ isLoading }) => this._isLoading = isLoading),
    shareReplay(1)
  );

  /**
   * Returns the current models or an empty list.
   */
  readonly models$: Observable<L[]> = this.stream$.pipe(map(x => x.list ?? []), shareReplay(1));
  readonly isLoading$: Observable<boolean> = this.stream$.pipe(map(x => x.isLoading), shareReplay(1));

  constructor(config?: Observable<S> | LoadingEventForModelListStateConfig<S>) {
    if (isObservable(config)) {
      this._config = {
        obs: config
      };
    } else {
      this._config = config ?? {
        alwaysShowLoadingOnRetrieving: false
      };
    }

    if (this._config.obs) {
      this.setStateObs(this._config.obs);
    }
  }

  /**
   * @deprecated Use isLoading$ instead.
   */
  get isLoading(): boolean {
    return this._isLoading;
  }

  setStateObs(state: Observable<S>): void {
    this._stateSubject$.next(state);
  }

}
