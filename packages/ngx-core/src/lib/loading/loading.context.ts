import { BehaviorSubject, isObservable, Observable, of } from 'rxjs';
import { mergeMap, tap, map, startWith, switchMap, shareReplay, catchError, delay, first, filter } from 'rxjs/operators';
import { LoadingContext, LoadingEvent } from './loading';
import { LoadingState } from './loading.state';


export interface LoadingStateLoadingEvent<T = any> extends LoadingEvent {
  model?: T;
}

export interface LoadingEventForLoadingPairConfig<S extends LoadingState = LoadingState> {
  /**
   * The initial observable.
   */
  obs?: Observable<S>;
  /**
   * Whether or not to show loading if a model is not defined.
   *
   * If strict, it will only be loading if loading is true.
   */
  strict?: boolean;
  /**
   *
   */
  always?: boolean;
}

export function loadingEventForLoadingPair<T, S extends LoadingState<T> = LoadingState<T>>(config: LoadingEventForLoadingPairConfig<S>, pair?: S): LoadingStateLoadingEvent<T> {
  let isLoading = !pair;
  const error = pair?.error;
  const model = pair?.model;
  const loading = pair?.loading;

  if (!error) {
    // Not loading if the model is there.
    // If strict is true, and there is no model, loading must also be true.
    isLoading = loading || (pair?.model == null && ((config.strict) ? pair?.loading : true));
  }

  return {
    isLoading,
    error,
    model
  };
}

/**
 * LoadingContext implementation that uses a LoadingState observable.
 */
export class LoadingStateLoadingContext<T = any, S extends LoadingState<T> = LoadingState<T>> implements LoadingContext {

  private _isLoading = true;
  private _stateSubject$ = new BehaviorSubject<Observable<S>>(undefined);
  private _config: LoadingEventForLoadingPairConfig<S>;

  readonly state$ = this._stateSubject$.pipe(switchMap(x => x));
  readonly stateObs$: Observable<Observable<S>> = this._stateSubject$.asObservable();

  readonly stream$: Observable<LoadingStateLoadingEvent<T>> = this._stateSubject$.pipe(
    mergeMap((obs) => {
      const start = {
        isLoading: true
      };

      if (obs) {
        return obs.pipe(
          startWith(start as any as S), // Always start with loading. Observable may not always update immediately.
          map((x) => loadingEventForLoadingPair<T, S>(this._config, x)),
          shareReplay(1)
        );
      } else {
        return of(start);
      }
    }),
    tap(({ isLoading }) => this._isLoading = isLoading)
  );

  readonly model$: Observable<T> = this.stream$.pipe(map(x => x.model), shareReplay(1));
  readonly modelAfterLoaded$: Observable<T> = this.stream$.pipe(filter(x => !x.isLoading), map(x => x.model), shareReplay(1));
  readonly isLoading$: Observable<boolean> = this.stream$.pipe(map(x => x.isLoading), shareReplay(1));

  constructor(config?: Observable<S> | LoadingEventForLoadingPairConfig<S>) {
    if (isObservable(config)) {
      this._config = {
        obs: config
      };
    } else {
      this._config = config ?? {
        strict: false
      };
    }

    if (this._config.obs) {
      this.setStateObs(this._config.obs);
    }
  }

  /**
   * @deprecated Use isLoading$ where possible.
   */
  get isLoading(): boolean {
    return this._isLoading;
  }

  setStateObs(state: Observable<S>): void {
    this._stateSubject$.next(state);
  }

  destroy(): void {
    this._stateSubject$.complete();
  }

}
