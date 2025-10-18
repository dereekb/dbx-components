import { type ObservableOrValueGetter, type MaybeObservableOrValueGetter, switchMapToDefault, maybeValueFromObservableOrValueGetter, asObservableFromGetter } from '@dereekb/rxjs';
import { type Destroyable, type Maybe } from '@dereekb/util';
import { BehaviorSubject, combineLatest, distinctUntilChanged, first, map, type Observable, shareReplay } from 'rxjs';
import { type DbxRouterService } from '../service/router.service';

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
   * The current value given the paramValue and the defaultValue.
   */
  readonly value$: Observable<Maybe<T>>;

  /**
   * Returns the current param key.
   */
  getParamKey(): string;

  /**
   * Sets a new param key. If the value is undefined, the param reader will use the default key.
   */
  setParamKey(paramKey: Maybe<string>): void;

  /**
   * Sets the default value source.
   *
   * @param defaultValue
   */
  setDefaultValue(defaultValue: MaybeObservableOrValueGetter<T>): void;

  /**
   * Updates the value on the current route for the paramKey.
   *
   * @param value
   */
  setParamValue(value: MaybeObservableOrValueGetter<T>): void;
}

export interface DbxRouteParamReaderInstance<T> extends DbxRouteParamReader<T>, Destroyable {
  readonly dbxRouterService: DbxRouterService;
  readonly paramKey$: Observable<string>;
  readonly nextDefaultValue$: Observable<Maybe<T>>;
  readonly value$: Observable<Maybe<T>>;
}

/**
 * Creates a new DbxRouteParamReaderInstance from the input.
 *
 * @param dbxRouterService
 * @param defaultParamKey
 * @param defaultValue
 * @returns
 */
export function dbxRouteParamReaderInstance<T>(dbxRouterService: DbxRouterService, defaultParamKey: string, defaultValue?: MaybeObservableOrValueGetter<T>): DbxRouteParamReaderInstance<T> {
  const _paramKey = new BehaviorSubject<string>(defaultParamKey);
  const _defaultValue = new BehaviorSubject<Maybe<ObservableOrValueGetter<Maybe<T>>>>(defaultValue);

  const paramKey$ = _paramKey.asObservable();

  const paramValue$ = combineLatest([paramKey$, dbxRouterService.params$]).pipe(
    map(([key, params]) => (params[key] as Maybe<T>) ?? undefined),
    distinctUntilChanged(),
    shareReplay(1)
  );

  const nextDefaultValue$ = _defaultValue.pipe(maybeValueFromObservableOrValueGetter(), shareReplay(1));
  const defaultValue$ = _defaultValue.pipe(maybeValueFromObservableOrValueGetter(), shareReplay(1));
  const value$ = paramValue$.pipe(switchMapToDefault(defaultValue$), shareReplay(1));

  const result: DbxRouteParamReaderInstance<T> = {
    dbxRouterService,

    paramKey$,
    paramValue$,
    nextDefaultValue$,
    defaultValue$,
    value$,

    destroy() {
      _paramKey.complete();
      _defaultValue.complete();
    },

    getParamKey(): string {
      return _paramKey.value;
    },

    setParamKey(paramKey: Maybe<string>) {
      _paramKey.next(paramKey || defaultParamKey);
    },

    setDefaultValue(newValue: MaybeObservableOrValueGetter<T>) {
      _defaultValue.next(newValue ?? defaultValue);
    },

    setParamValue(value: MaybeObservableOrValueGetter<T>) {
      combineLatest([paramKey$, asObservableFromGetter(value)])
        .pipe(first())
        .subscribe(([paramKey, value]) => dbxRouterService.updateParams({ [paramKey]: value }));
    }
  };

  return result;
}
