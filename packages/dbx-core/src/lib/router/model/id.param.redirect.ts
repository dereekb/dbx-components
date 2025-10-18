import { type Observable, BehaviorSubject, map, shareReplay, of, switchMap } from 'rxjs';
import { type Destroyable, type Initialized, type Maybe, type ModelKey } from '@dereekb/util';
import { type MaybeObservableOrValueGetter, type SwitchMapToDefaultFilterFunction } from '@dereekb/rxjs';
import { type DbxRouterService } from '../router/service';
import { type DbxRouteParamReader, dbxRouteParamReaderInstance, DbxRouteParamDefaultRedirectInstance } from '../router/util';

/**
 * Default identifier used by dbxRouteModelIdParamRedirect() that corresponds to the id param of the model in the current route.
 */
export const DBX_ROUTE_MODEL_ID_PARAM_DEFAULT_ID_PARAM_KEY = 'id';

/**
 * Default identifier used by dbxRouteModelIdParamRedirect() that corresponds to the key param of the model in the current route.
 */
export const DBX_ROUTE_MODEL_ID_PARAM_DEFAULT_KEY_PARAM_KEY = 'key';

/**
 * Default value used by dbxRouteModelIdParamRedirect() for when a value is not available or provided.
 */
export const DBX_ROUTE_MODEL_ID_PARAM_DEFAULT_USE_PARAM_VALUE = '0';

/**
 * Used to read an id with a specific key from the current route.
 *
 * Can be configured to redirect to a default route if a specific value is seen.
 */
export interface DbxRouteModelIdParamRedirect extends DbxRouteParamReader<ModelKey> {
  /**
   * The id value as it is from the current state's params.
   */
  readonly idFromParams$: Observable<Maybe<ModelKey>>;
  /**
   * The id value as it is when considering the default value.
   */
  readonly id$: Observable<Maybe<ModelKey>>;
  setRedirectEnabled(redirect: Maybe<boolean>): void;
  setDecider(decider: string | SwitchMapToDefaultFilterFunction<ModelKey>): void;
}

/**
 *DbxRouteModelIdParamRedirect instance
 */
export interface DbxRouteModelIdParamRedirectInstance extends DbxRouteModelIdParamRedirect, DbxRouteParamReader<ModelKey>, Initialized, Destroyable {
  readonly paramValue$: Observable<Maybe<string>>;
  readonly defaultValue$: Observable<Maybe<string>>;
  readonly value$: Observable<Maybe<string>>;

  readonly idFromParams$: Observable<Maybe<ModelKey>>;
  readonly id$: Observable<Maybe<ModelKey>>;

  setParamKey(paramKey: Maybe<string>): void;

  setDefaultValue(defaultValue: MaybeObservableOrValueGetter<string>): void;
  setRedirectEnabled(redirect: Maybe<boolean>): void;

  setDecider(decider: string | SwitchMapToDefaultFilterFunction<ModelKey>): void;
  setParamValue(value: MaybeObservableOrValueGetter<string>): void;
}

export function dbxRouteModelKeyParamRedirect(dbxRouterService: DbxRouterService, defaultParamKey: string = DBX_ROUTE_MODEL_ID_PARAM_DEFAULT_KEY_PARAM_KEY): DbxRouteModelIdParamRedirectInstance {
  return dbxRouteModelIdParamRedirect(dbxRouterService, defaultParamKey);
}

export function dbxRouteModelIdParamRedirect(dbxRouterService: DbxRouterService, defaultParamKey: string = DBX_ROUTE_MODEL_ID_PARAM_DEFAULT_ID_PARAM_KEY): DbxRouteModelIdParamRedirectInstance {
  const _paramReader = dbxRouteParamReaderInstance<ModelKey>(dbxRouterService, defaultParamKey);
  const _paramRedirect = new DbxRouteParamDefaultRedirectInstance<ModelKey>(_paramReader);
  const _useDefaultParamDecider = new BehaviorSubject<string | SwitchMapToDefaultFilterFunction<ModelKey>>(DBX_ROUTE_MODEL_ID_PARAM_DEFAULT_USE_PARAM_VALUE);

  const _useDefaultParam$: Observable<SwitchMapToDefaultFilterFunction<ModelKey>> = _useDefaultParamDecider.pipe(
    map((x) => {
      let result: SwitchMapToDefaultFilterFunction<ModelKey>;

      if (typeof x === 'string') {
        result = (value: Maybe<ModelKey>) => of(value === x);
      } else {
        result = x;
      }

      return result;
    }),
    shareReplay(1)
  );

  const setParamKey = (paramKey: Maybe<string>) => {
    _paramReader.setParamKey(paramKey || defaultParamKey);
  };

  const paramValue$ = _paramReader.paramValue$;
  const value$ = _paramReader.value$;

  const result: DbxRouteModelIdParamRedirectInstance = {
    paramValue$,
    defaultValue$: _paramReader.defaultValue$,
    value$,
    idFromParams$: paramValue$,
    id$: value$,

    init(): void {
      _paramRedirect.setUseDefaultFilter((value: Maybe<string>) => {
        return _useDefaultParam$.pipe(switchMap((x) => x(value)));
      });

      _paramRedirect.init();
    },

    destroy(): void {
      _paramReader.destroy();
      _paramRedirect.destroy();
      _useDefaultParamDecider.complete();
    },

    getParamKey(): string {
      return _paramReader.getParamKey();
    },

    setParamKey,

    setDefaultValue(defaultValue: MaybeObservableOrValueGetter<string>): void {
      _paramReader.setDefaultValue(defaultValue);
    },

    setRedirectEnabled(redirect: Maybe<boolean>): void {
      _paramRedirect.enabled = redirect !== false;
    },

    setDecider(decider: string | SwitchMapToDefaultFilterFunction<ModelKey>): void {
      _useDefaultParamDecider.next(decider);
    },

    setParamValue(value: MaybeObservableOrValueGetter<string>): void {
      _paramReader.setParamValue(value);
    }
  };

  return result;
}
