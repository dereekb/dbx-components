import { Maybe, Destroyable } from '@dereekb/util';
import { filterMaybe } from '@dereekb/util-rxjs';
import { BehaviorSubject, isObservable, Observable, of } from 'rxjs';
import { mergeMap, map, startWith, switchMap, shareReplay, distinctUntilChanged } from 'rxjs/operators';
import { LoadingContext, LoadingEvent } from './loading';
import { LoadingState } from './loading.state';


export interface AbstractLoadingStateLoadingEvent<T = any> extends LoadingEvent {
  model?: Maybe<T>;
}

export interface AbstractLoadingEventForLoadingPairConfig<S extends LoadingState = LoadingState> {
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
}

/**
 * Abstract LoadingContext implementation using LoadingState.
 */
export abstract class AbstractLoadingStateLoadingContext<T = any, S extends LoadingState<T> = LoadingState<T>, E extends LoadingEvent = LoadingEvent, C extends AbstractLoadingEventForLoadingPairConfig<S> = AbstractLoadingEventForLoadingPairConfig<S>> implements LoadingContext, Destroyable {

  private _stateSubject$ = new BehaviorSubject<Maybe<Observable<S>>>(undefined);
  private _config: C;

  readonly stateSubject$ = this._stateSubject$.pipe(filterMaybe(), distinctUntilChanged(), shareReplay(1));
  readonly state$ = this.stateSubject$.pipe(switchMap(x => x), shareReplay(1));
  readonly stateObs$: Observable<Maybe<Observable<S>>> = this._stateSubject$.asObservable();

  readonly stream$: Observable<E> = this._stateSubject$.pipe(
    mergeMap((obs) => {
      const start = {
        isLoading: true
      } as E;

      if (obs) {
        return obs.pipe(
          startWith(start as any as S), // Always start with loading. Observable may not always update immediately.
          map((x) => this.loadingEventForLoadingPair(x, this._config))
        );
      } else {
        return of(start);
      }
    }),
    shareReplay(1)
  );

  readonly isLoading$: Observable<boolean> = this.stream$.pipe(map(x => x.isLoading), shareReplay(1));

  constructor(config?: Observable<S> | C) {
    if (isObservable(config)) {
      this._config = {
        obs: config
      } as C;
    } else {
      this._config = config ?? {
        strict: false
      } as C;
    }

    if (this._config.obs) {
      this.setStateObs(this._config.obs);
    }
  }

  protected abstract loadingEventForLoadingPair(state: S, config: C): E;

  setStateObs(state: Observable<S>): void {
    this._stateSubject$.next(state);
  }

  destroy(): void {
    this._stateSubject$.complete();
  }

}
