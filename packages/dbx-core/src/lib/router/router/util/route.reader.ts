import { ObservableOrValueGetter, MaybeObservableOrValueGetter, switchMapToDefault, maybeValueFromObservableOrValueGetter } from '@dereekb/rxjs';
import { Destroyable, Maybe } from '@dereekb/util';
import { BehaviorSubject, combineLatest, distinctUntilChanged, map, Observable, shareReplay } from 'rxjs';
import { DbxRouterService } from '../service/router.service';

/**
 * Interface used for reading a single value from the DbxRouterService. Supports a default value.
 */
export interface DbxRouteParamReader<T> {
  /**
   * The param value as read from the current router state.
   */
  readonly paramValue$: Observable<Maybe<T>>;
  /**
   * The default value observable.
   */
  readonly defaultValue$: Observable<Maybe<T>>;
  /**
   * The final computed value
   */
  readonly value$: Observable<Maybe<T>>;

  get paramKey(): string;
  set paramKey(paramKey: Maybe<string>);

  /**
   * Sets the default value source.
   *
   * @param defaultValue
   */
  setDefaultValue(defaultValue: MaybeObservableOrValueGetter<T>): void;
}

/**
 * Utility class used for reading a single value from the DbxRouterService.
 */
export class DbxRouteParamReaderInstance<T> implements DbxRouteParamReader<T>, Destroyable {
  private _paramKey = new BehaviorSubject<string>(this.defaultParamKey);
  readonly paramKey$ = this._paramKey.asObservable();

  private _defaultValue = new BehaviorSubject<Maybe<ObservableOrValueGetter<Maybe<T>>>>(this.defaultValue);

  readonly paramValue$: Observable<Maybe<T>> = combineLatest([this.paramKey$, this.dbxRouterService.params$]).pipe(
    map(([key, params]) => {
      return (params[key] as Maybe<T>) ?? undefined;
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly defaultValue$: Observable<Maybe<T>> = this._defaultValue.pipe(maybeValueFromObservableOrValueGetter(), shareReplay(1));

  readonly value$: Observable<Maybe<T>> = this.paramValue$.pipe(switchMapToDefault(this.defaultValue$), shareReplay(1));

  constructor(readonly dbxRouterService: DbxRouterService, readonly defaultParamKey: string, readonly defaultValue?: MaybeObservableOrValueGetter<T>) {}

  destroy(): void {
    this._paramKey.complete();
  }

  get paramKey(): string {
    return this._paramKey.value;
  }

  set paramKey(paramKey: Maybe<string>) {
    this._paramKey.next(paramKey || this.defaultParamKey);
  }

  setDefaultValue(defaultValue: MaybeObservableOrValueGetter<T>): void {
    this._defaultValue.next(defaultValue ?? this.defaultValue);
  }
}
