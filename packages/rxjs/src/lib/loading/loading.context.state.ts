import { Maybe, Destroyable } from '@dereekb/util';
import { filterMaybe, timeoutStartWith, beginLoading } from '@dereekb/rxjs';
import { mergeMap, map, switchMap, shareReplay, distinctUntilChanged, BehaviorSubject, isObservable, Observable, of } from 'rxjs';
import { LoadingContext, LoadingContextEvent } from './loading.context';
import { LoadingState } from './loading.state';

export interface AbstractLoadingStateEvent<T = any> extends LoadingContextEvent {
  value?: Maybe<T>;
}

export interface AbstractLoadingEventForLoadingPairConfig<S extends LoadingState = LoadingState> {
  /**
   * The initial observable.
   */
  obs?: Observable<S>;
  /**
   * Whether or not to show loading if a value is defined.
   */
  showLoadingOnNoValue?: boolean;
}

export interface AbstractLoadingStateContext<T = any, S extends LoadingState<T> = LoadingState<T>, E extends LoadingContextEvent = LoadingContextEvent> {
  readonly stateObs$: Observable<Maybe<Observable<S>>>;
  readonly stateSubject$: Observable<Observable<S>>;
  readonly state$: Observable<S>;
  readonly stream$: Observable<E>;
  readonly loading$: Observable<boolean>;
}

export type LoadingStateContextInstanceInputConfig<S, C> = Observable<S> | C;

/**
 * Abstract LoadingContext implementation using LoadingState.
 */
export abstract class AbstractLoadingStateContextInstance<T = any, S extends LoadingState<T> = LoadingState<T>, E extends AbstractLoadingStateEvent<T> = AbstractLoadingStateEvent<T>, C extends AbstractLoadingEventForLoadingPairConfig<S> = AbstractLoadingEventForLoadingPairConfig<S>>
  implements AbstractLoadingStateContext<T, S, E>, LoadingContext, Destroyable {

  private _stateSubject$ = new BehaviorSubject<Maybe<Observable<S>>>(undefined);
  private _config: C;

  readonly stateSubject$ = this._stateSubject$.pipe(filterMaybe(), distinctUntilChanged(), shareReplay(1));
  readonly state$ = this.stateSubject$.pipe(switchMap(x => x), shareReplay(1));
  readonly stateObs$: Observable<Maybe<Observable<S>>> = this._stateSubject$.asObservable();

  readonly stream$: Observable<E> = this._stateSubject$.pipe(
    mergeMap((obs) => {
      if (obs) {
        return obs.pipe(
          // If the observable did not pass a value immediately, we start with the start value.
          timeoutStartWith<S>(beginLoading() as S),
          map((x) => this.loadingEventForLoadingPair(x, this._config))
        );
      } else {
        return of(beginLoading() as E);
      }
    }),
    distinctUntilChanged((a: E, b: E) => {
      return a.loading === b.loading && a.error === b.error && a.value === b.value
    }),
    shareReplay(1)
  );

  /**
   * Emits when the input state has changed.
   */
  readonly stateChange$: Observable<void> = this._stateSubject$.pipe(map(() => undefined));
  readonly loading$: Observable<boolean> = this.stream$.pipe(map(x => x.loading), shareReplay(1));

  constructor(config?: LoadingStateContextInstanceInputConfig<S, C>) {
    if (isObservable(config)) {
      this._config = {
        obs: config
      } as C;
    } else {
      this._config = config ?? {
        showLoadingOnNoValue: false
      } as C;
    }

    if (this._config.obs) {
      this.setStateObs(this._config.obs);
    }
  }

  protected abstract loadingEventForLoadingPair(state: S, config: C): E;

  setStateObs(state: Maybe<Observable<S>>): void {
    this._stateSubject$.next(state);
  }

  destroy(): void {
    this._stateSubject$.complete();
  }

}
